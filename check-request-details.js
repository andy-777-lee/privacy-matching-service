// Check unlock request details
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRequest() {
    try {
        const requestDoc = await db.collection('unlock_requests').doc('request_1764582093755').get();

        if (!requestDoc.exists) {
            console.log('Request not found');
            process.exit(0);
        }

        const request = requestDoc.data();

        console.log('📋 Request Details:\n');
        console.log('Request ID:', request.id);
        console.log('Requester ID:', request.requesterId);
        console.log('Target ID:', request.targetId);
        console.log('Status:', request.status);
        console.log('Timestamp (raw):', request.timestamp);
        console.log('Timestamp (date):', new Date(request.timestamp).toLocaleString('ko-KR'));
        console.log('');

        // Get user names
        const requesterDoc = await db.collection('users').doc(request.requesterId).get();
        const targetDoc = await db.collection('users').doc(request.targetId).get();

        console.log('Requester:', requesterDoc.exists ? requesterDoc.data().name : 'Not found');
        console.log('Target:', targetDoc.exists ? targetDoc.data().name : 'Not found');
        console.log('');

        // Check if requester still exists
        console.log('Current 박혜림 account ID: d1EunUgU5dP8nUhjlkphmJDBkfm1');
        console.log('Request requester ID:', request.requesterId);
        console.log('');

        if (request.requesterId === 'd1EunUgU5dP8nUhjlkphmJDBkfm1') {
            console.log('✅ YES! The request is from the CURRENT 박혜림 account (kept)');
        } else if (request.requesterId === 'pRAUfGvSaaaC47VyMWuNzZPMHcB2') {
            console.log('❌ NO! The request is from the DELETED 박혜림 account');
            console.log('⚠️  This request is now orphaned and should be deleted or transferred');
        } else {
            console.log('❓ Unknown requester ID');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkRequest();
