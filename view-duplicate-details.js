// View details of duplicate users to decide which to keep
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function viewDuplicates() {
    try {
        const duplicatePairs = [
            {
                name: '구민수',
                ids: ['iYDbFcyLB1Zc3Q1Qh7COrxvPqwW2', 'uoLSH6qhlGhrpEPocO7UEvRtOEF3']
            },
            {
                name: '박혜림',
                ids: ['d1EunUgU5dP8nUhjlkphmJDBkfm1', 'pRAUfGvSaaaC47VyMWuNzZPMHcB2']
            }
        ];

        for (const pair of duplicatePairs) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`👤 ${pair.name} - ${pair.ids.length} profiles found`);
            console.log('='.repeat(60));

            for (let i = 0; i < pair.ids.length; i++) {
                const userId = pair.ids[i];
                const doc = await db.collection('users').doc(userId).get();

                if (doc.exists) {
                    const data = doc.data();
                    console.log(`\n[Profile ${i + 1}] ID: ${userId}`);
                    console.log(`  Name: ${data.name}`);
                    console.log(`  Email: ${data.email || 'N/A'}`);
                    console.log(`  Birth Year: ${data.birthYear || 'N/A'}`);
                    console.log(`  Gender: ${data.gender || 'N/A'}`);
                    console.log(`  Height: ${data.height || 'N/A'}`);
                    console.log(`  Job: ${data.job || 'N/A'}`);
                    console.log(`  Location: ${data.location || 'N/A'}`);
                    console.log(`  Photos: ${data.photos ? data.photos.length : 0} photos`);
                    console.log(`  Preferences: ${data.preferences ? Object.keys(data.preferences).length : 0} items`);
                    console.log(`  Created: ${data.createdAt || 'N/A'}`);
                } else {
                    console.log(`\n[Profile ${i + 1}] ID: ${userId} - NOT FOUND`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('💡 Recommendation: Keep the profile with more complete data');
        console.log('   (more photos, preferences set, etc.)');
        console.log('='.repeat(60) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

viewDuplicates();
