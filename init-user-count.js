// Initialize user count in stats collection
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function initializeUserCount() {
    try {
        // Count current users
        // Count current users using aggregation (cost-efficient)
        const countSnapshot = await db.collection('users').count().get();
        const userCount = countSnapshot.data().count;

        // Create/update stats document
        await db.collection('stats').doc('userCount').set({
            count: userCount,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ User count initialized: ${userCount}`);
        console.log('Stats document created at: stats/userCount');

        process.exit(0);
    } catch (error) {
        console.error('Error initializing user count:', error);
        process.exit(1);
    }
}

initializeUserCount();
