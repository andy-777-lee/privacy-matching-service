// Check if the remaining 박혜림 account matches the unlock request
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAccount() {
    try {
        console.log('🔍 Checking 박혜림 account and unlock requests...\n');

        // Find 박혜림 user
        const usersSnapshot = await db.collection('users').where('name', '==', '박혜림').get();

        if (usersSnapshot.empty) {
            console.log('❌ No user found with name "박혜림"');
            process.exit(0);
        }

        console.log(`Found ${usersSnapshot.docs.length} user(s) with name "박혜림":\n`);

        const parkHyeRim = usersSnapshot.docs[0].data();
        const parkId = usersSnapshot.docs[0].id;

        console.log('👤 박혜림 Account:');
        console.log(`   User ID: ${parkId}`);
        console.log(`   Name: ${parkHyeRim.name}`);
        console.log(`   Birth Year: ${parkHyeRim.birthYear}`);
        console.log(`   Gender: ${parkHyeRim.gender}`);
        console.log(`   Created: ${new Date(parkHyeRim.createdAt).toLocaleString('ko-KR')}`);
        console.log('');

        // Find unlock requests from 박혜림
        console.log('📋 Unlock Requests from 박혜림:\n');
        const requestsSnapshot = await db.collection('unlock_requests')
            .where('requesterId', '==', parkId)
            .get();

        if (requestsSnapshot.empty) {
            console.log('   No unlock requests found from this account');
        } else {
            for (const doc of requestsSnapshot.docs) {
                const request = doc.data();

                // Get target user info
                const targetDoc = await db.collection('users').doc(request.targetId).get();
                const targetName = targetDoc.exists ? targetDoc.data().name : 'Unknown';

                const requestTime = new Date(request.timestamp);
                console.log(`   Request ID: ${request.id}`);
                console.log(`   → Target: ${targetName} (${request.targetId})`);
                console.log(`   Status: ${request.status}`);
                console.log(`   Time: ${requestTime.toLocaleString('ko-KR')}`);
                console.log('');
            }
        }

        // Check for the specific request mentioned (2025. 12. 1. 오후 6:41:33)
        console.log('🔎 Checking for request at 2025. 12. 1. 오후 6:41:33...\n');

        // Convert to timestamp (assuming Korean timezone)
        const targetTime = new Date('2025-12-01T18:41:33+09:00').getTime();
        const timeWindow = 60000; // 1 minute window

        const allRequests = await db.collection('unlock_requests').get();

        for (const doc of allRequests.docs) {
            const request = doc.data();
            const requestTime = request.timestamp;

            if (Math.abs(requestTime - targetTime) < timeWindow) {
                const requesterDoc = await db.collection('users').doc(request.requesterId).get();
                const targetDoc = await db.collection('users').doc(request.targetId).get();

                const requesterName = requesterDoc.exists ? requesterDoc.data().name : 'Unknown';
                const targetName = targetDoc.exists ? targetDoc.data().name : 'Unknown';

                console.log('✅ Found matching request:');
                console.log(`   Requester: ${requesterName} (${request.requesterId})`);
                console.log(`   Target: ${targetName} (${request.targetId})`);
                console.log(`   Status: ${request.status}`);
                console.log(`   Time: ${new Date(requestTime).toLocaleString('ko-KR')}`);
                console.log('');

                if (request.requesterId === parkId) {
                    console.log('✅ YES! This request matches the current 박혜림 account!');
                } else {
                    console.log('❌ NO! This request is from a different account (deleted duplicate)');
                    console.log(`   Current 박혜림 ID: ${parkId}`);
                    console.log(`   Request from ID: ${request.requesterId}`);
                }
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAccount();
