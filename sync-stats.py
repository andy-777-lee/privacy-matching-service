import json
import time
import requests
import jwt # PyJWT
from datetime import datetime

# Load service account key
with open('serviceAccountKey.json', 'r') as f:
    sa = json.load(f)

def get_access_token():
    iat = int(time.time())
    exp = iat + 3600
    payload = {
        'iss': sa['client_email'],
        'sub': sa['client_email'],
        'aud': 'https://firestore.googleapis.com/',
        'iat': iat,
        'exp': exp
    }
    # For Firestore REST API, we can sometimes use simpler auth or just the API key if allowed,
    # but the service account is safest.
    # Actually, getting a Google OAuth token is better.
    payload['aud'] = 'https://oauth2.googleapis.com/token'
    payload['scope'] = 'https://www.googleapis.com/auth/datastore'
    
    encoded_jwt = jwt.encode(payload, sa['private_key'], algorithm='RS256')
    
    r = requests.post('https://oauth2.googleapis.com/token', data={
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': encoded_jwt
    })
    return r.json()['access_token']

def sync_stats():
    token = get_access_token()
    project_id = sa['project_id']
    base_url = f'https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents'
    headers = {'Authorization': f'Bearer {token}'}

    print("Fetching users...")
    users_r = requests.get(f'{base_url}/users', headers=headers)
    users = users_r.json().get('documents', [])
    
    # Handle pagination if necessary (for 122 users it might be single page, but let's be careful)
    # Firestore REST API default page size is 20, but we can increase it or loop.
    # Let's just fetch simplified data.
    all_users = []
    next_page_token = users_r.json().get('nextPageToken')
    all_users.extend(users)
    while next_page_token:
        users_r = requests.get(f'{base_url}/users?pageToken={next_page_token}', headers=headers)
        all_users.extend(users_r.json().get('documents', []))
        next_page_token = users_r.json().get('nextPageToken')

    print(f"Fetched {len(all_users)} users.")

    print("Fetching requests...")
    reqs_r = requests.get(f'{base_url}/unlock_requests', headers=headers)
    all_reqs = []
    next_page_token = reqs_r.json().get('nextPageToken')
    all_reqs.extend(reqs_r.json().get('documents', []))
    while next_page_token:
        reqs_r = requests.get(f'{base_url}/unlock_requests?pageToken={next_page_token}', headers=headers)
        all_reqs.extend(reqs_r.json().get('documents', []))
        next_page_token = reqs_r.json().get('nextPageToken')
    
    print(f"Fetched {len(all_reqs)} requests.")

    # Process data
    def format_date(ts):
        dt = datetime.fromtimestamp(int(ts) / 1000)
        return f"{dt.month}/{dt.day}"

    # Process data
    user_timestamps = []
    active_dates = []
    for doc in all_users:
        fields = doc.get('fields', {})
        # Registration date
        reg_ts = fields.get('createdAt', {}).get('integerValue') or fields.get('timestamp', {}).get('integerValue')
        if reg_ts:
            user_timestamps.append(int(reg_ts))
        
        # Last active date
        active_ts = fields.get('lastLogin', {}).get('integerValue')
        if active_ts:
            active_dates.append(format_date(int(active_ts)))

    def get_ts(doc):
        fields = doc.get('fields', {})
        return fields.get('createdAt', {}).get('integerValue') or fields.get('timestamp', {}).get('integerValue')

    def get_status(doc):
        return doc.get('fields', {}).get('status', {}).get('stringValue', 'pending')

    data_by_date = {} # { date: { users: 0, total_req: 0, approved: 0, rejected: 0, active: 0 } }

    for ts in user_timestamps:
        d = format_date(ts)
        if d not in data_by_date: data_by_date[d] = {'u': 0, 'tr': 0, 'ap': 0, 'rj': 0, 'act': 0}
        data_by_date[d]['u'] += 1
    
    for doc in all_reqs:
        ts = get_ts(doc)
        if not ts: continue
        d = format_date(ts)
        status = get_status(doc)
        
        if d not in data_by_date: data_by_date[d] = {'u': 0, 'tr': 0, 'ap': 0, 'rj': 0, 'act': 0}
        data_by_date[d]['tr'] += 1
        if status == 'approved':
            data_by_date[d]['ap'] += 1
        elif status == 'rejected':
            data_by_date[d]['rj'] += 1

    for d in active_dates:
        if d in data_by_date:
            data_by_date[d]['act'] += 1
        else:
            # If a user logged in on a day with no registrations/requests, we still want to show it
            data_by_date[d] = {'u': 0, 'tr': 0, 'ap': 0, 'rj': 0, 'act': 1}

    sorted_dates = sorted(data_by_date.keys(), key=lambda x: [int(v) for v in x.split('/')])
    
    cumulative_users = 0
    cumulative_total_req = 0
    cumulative_approved = 0
    cumulative_rejected = 0
    
    user_history = []
    request_history = []
    approved_history = []
    rejected_history = []
    active_history = [] # This will be DAILY (not cumulative)
    daily_user_history = [] # New: daily registrations
    daily_request_history = [] # New: daily requests
    
    for date in sorted_dates:
        cumulative_users += data_by_date[date]['u']
        cumulative_total_req += data_by_date[date]['tr']
        cumulative_approved += data_by_date[date]['ap']
        cumulative_rejected += data_by_date[date]['rj']
        
        user_history.append(cumulative_users)
        request_history.append(cumulative_total_req)
        approved_history.append(cumulative_approved)
        rejected_history.append(cumulative_rejected)
        
        active_history.append(data_by_date[date]['act'])
        daily_user_history.append(data_by_date[date]['u'])
        daily_request_history.append(data_by_date[date]['tr'])

    # Calculate final match counts
    approved = [doc for doc in all_reqs if get_status(doc) == 'approved']
    matched_counts = {} # user_id -> number of matches
    for doc in approved:
        fields = doc.get('fields', {})
        req_id = fields.get('requesterId', {}).get('stringValue')
        tar_id = fields.get('targetId', {}).get('stringValue')
        if req_id: matched_counts[req_id] = matched_counts.get(req_id, 0) + 1
        if tar_id: matched_counts[tar_id] = matched_counts.get(tar_id, 0) + 1

    one_plus_matches = [u for u, count in matched_counts.items() if count >= 1]
    two_plus_matches = [u for u, count in matched_counts.items() if count >= 2]
    max_matches = max(matched_counts.values()) if matched_counts else 0

    # Calculate request stats
    sent_counts = {}
    received_counts = {}
    for doc in all_reqs:
        fields = doc.get('fields', {})
        req_id = fields.get('requesterId', {}).get('stringValue')
        tar_id = fields.get('targetId', {}).get('stringValue')
        if req_id: sent_counts[req_id] = sent_counts.get(req_id, 0) + 1
        if tar_id: received_counts[tar_id] = received_counts.get(tar_id, 0) + 1
    
    max_sent = max(sent_counts.values()) if sent_counts else 0
    max_received = max(received_counts.values()) if received_counts else 0

    # Write back to stats/growth_trend
    payload = {
        'fields': {
            'labels': {'arrayValue': {'values': [{'stringValue': d} for d in sorted_dates]}},
            'userHistory': {'arrayValue': {'values': [{'integerValue': str(v)} for v in user_history]}},
            'requestHistory': {'arrayValue': {'values': [{'integerValue': str(v)} for v in request_history]}},
            'dailyUserHistory': {'arrayValue': {'values': [{'integerValue': str(v)} for v in daily_user_history]}},
            'dailyRequestHistory': {'arrayValue': {'values': [{'integerValue': str(v)} for v in daily_request_history]}},
            'totalUsers': {'integerValue': str(len(all_users))},
            'totalRequests': {'integerValue': str(len(all_reqs))},
            'approvedCount': {'integerValue': str(len(approved))},
            'matchedPeopleCount': {'integerValue': str(len(one_plus_matches))},
            'multiMatchedCount': {'integerValue': str(len(two_plus_matches))},
            'maxMatches': {'integerValue': str(max_matches)},
            'maxSentRequests': {'integerValue': str(max_sent)},
            'maxReceivedRequests': {'integerValue': str(max_received)},
            'lastUpdated': {'timestampValue': datetime.utcnow().isoformat() + 'Z'}
        }
    }
    
    print("Saving stats to stats/growth_trend...")
    save_r = requests.patch(f'{base_url}/stats/growth_trend', headers=headers, json=payload)
    if save_r.status_code == 200:
        print("✅ Stats synced successfully!")
    else:
        print(f"❌ Failed to save stats: {save_r.text}")

if __name__ == "__main__":
    sync_stats()
