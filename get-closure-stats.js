const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function getStats() {
    try {
        // 1. User Count
        const userCountSnapshot = await db.collection('users').get();
        const userCount = userCountSnapshot.size;

        // 2. Profile Disclosures (Unlocked Profiles)
        const unlockedSnapshot = await db.collection('unlockedProfiles').get();
        let totalDisclosures = 0;
        unlockedSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.unlocked && Array.isArray(data.unlocked)) {
                totalDisclosures += data.unlocked.length;
            }
        });

        console.log('--- Service Stats ---');
        console.log(`Total Users: ${userCount}`);
        console.log(`Total Profile Disclosures: ${totalDisclosures}`);
        console.log('---------------------');

        process.exit(0);
    } catch (error) {
        console.error('Error fetching stats:', error);
        process.exit(1);
    }
}

getStats();
