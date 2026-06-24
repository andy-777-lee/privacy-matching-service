const functions = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ── Gen 1: User count triggers (existing) ──────────────────────────────────

exports.incrementUserCount = functions.firestore
    .document('users/{userId}')
    .onCreate(async (snap, context) => {
        const statsRef = db.collection('stats').doc('userCount');
        try {
            await db.runTransaction(async (transaction) => {
                const statsDoc = await transaction.get(statsRef);
                if (!statsDoc.exists) {
                    transaction.set(statsRef, {
                        count: 1,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    const currentCount = statsDoc.data().count || 0;
                    transaction.update(statsRef, {
                        count: currentCount + 1,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
            console.log('User count incremented');
        } catch (error) {
            console.error('Error incrementing user count:', error);
        }
    });

exports.decrementUserCount = functions.firestore
    .document('users/{userId}')
    .onDelete(async (snap, context) => {
        const statsRef = db.collection('stats').doc('userCount');
        try {
            await db.runTransaction(async (transaction) => {
                const statsDoc = await transaction.get(statsRef);
                if (statsDoc.exists) {
                    const currentCount = statsDoc.data().count || 0;
                    transaction.update(statsRef, {
                        count: Math.max(0, currentCount - 1),
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
            console.log('User count decremented');
        } catch (error) {
            console.error('Error decrementing user count:', error);
        }
    });

// ── Gen 2: Kakao Login ─────────────────────────────────────────────────────

// Verifies Kakao access token and returns a Firebase custom token.
// The client receives the custom token and signs in with signInWithCustomToken().
exports.kakaoLogin = onCall(async (request) => {
    const { accessToken } = request.data;
    if (!accessToken) {
        throw new HttpsError('invalid-argument', 'accessToken is required');
    }

    let kakaoUser;
    try {
        const res = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        kakaoUser = res.data;
    } catch (err) {
        console.error('Kakao API error:', err.response?.data || err.message);
        throw new HttpsError('unauthenticated', 'Failed to verify Kakao token');
    }

    const kakaoId = String(kakaoUser.id);
    const uid = `kakao:${kakaoId}`;
    const profile = kakaoUser.kakao_account?.profile || {};

    const customToken = await admin.auth().createCustomToken(uid, {
        provider: 'kakao',
        kakaoId
    });

    return {
        customToken,
        kakaoId,
        nickname: profile.nickname || '',
        profileImageUrl: profile.profile_image_url || ''
    };
});

// ── Gen 2: Push Notifications ──────────────────────────────────────────────

async function sendPush(userId, title, body) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const fcmToken = userDoc.data()?.fcmToken;
        if (!fcmToken) return;

        await admin.messaging().send({
            token: fcmToken,
            notification: { title, body },
            webpush: {
                notification: {
                    icon: '/icon-192.png',
                    badge: '/icon-192.png'
                }
            }
        });
        console.log(`Push sent to user ${userId}`);
    } catch (error) {
        // Invalid token — clean it up so we don't keep trying
        if (error.code === 'messaging/registration-token-not-registered') {
            await db.collection('users').doc(userId).update({ fcmToken: null });
        } else {
            console.error(`Push failed for ${userId}:`, error.message);
        }
    }
}

// Notify target user when someone requests to see their profile
exports.onUnlockRequestCreated = onDocumentCreated('unlock_requests/{requestId}', async (event) => {
    const req = event.data.data();
    if (!req.targetId) return;

    // Get requester name for the notification body
    const requesterDoc = await db.collection('users').doc(req.requesterId).get();
    const requesterName = requesterDoc.data()?.name || '누군가';

    await sendPush(
        req.targetId,
        '새 프로필 공개 요청',
        `${requesterName}님이 회원님의 프로필을 보고 싶어합니다!`
    );
});

// Notify requester when their request is approved or rejected
exports.onUnlockRequestUpdated = onDocumentUpdated('unlock_requests/{requestId}', async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only act on status changes
    if (before.status === after.status) return;

    const requesterId = after.requesterId;

    if (after.status === 'approved') {
        await sendPush(
            requesterId,
            '프로필 공개 승인!',
            '요청하신 프로필이 공개되었습니다. 지금 확인해보세요!'
        );
    } else if (after.status === 'rejected') {
        await sendPush(
            requesterId,
            '프로필 공개 거절',
            '아쉽게도 이번 요청이 거절되었습니다.'
        );
    }
});
