// Check for duplicate users in Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDuplicates() {
    try {
        console.log('Fetching all users from Firestore...');
        const snapshot = await db.collection('users').get();

        console.log(`Total documents: ${snapshot.docs.length}`);

        const users = snapshot.docs.map(doc => ({
            docId: doc.id,
            ...doc.data()
        }));

        // Group by user ID
        const userGroups = {};
        users.forEach(user => {
            const userId = user.id || user.docId;
            if (!userGroups[userId]) {
                userGroups[userId] = [];
            }
            userGroups[userId].push(user);
        });

        // Find duplicates
        console.log('\n=== Checking for duplicates ===\n');
        let duplicateCount = 0;

        for (const [userId, userList] of Object.entries(userGroups)) {
            if (userList.length > 1) {
                duplicateCount++;
                console.log(`❌ DUPLICATE FOUND: User ID "${userId}" appears ${userList.length} times`);
                userList.forEach((user, index) => {
                    console.log(`   [${index + 1}] Document ID: ${user.docId}, Name: ${user.name}, Email: ${user.email}`);
                });
                console.log('');
            }
        }

        if (duplicateCount === 0) {
            console.log('✅ No duplicates found!');
        } else {
            console.log(`\n⚠️  Found ${duplicateCount} duplicate user(s)`);
        }

        // Show all users
        console.log('\n=== All Users ===\n');
        users.forEach((user, index) => {
            console.log(`${index + 1}. Doc ID: ${user.docId} | User ID: ${user.id} | Name: ${user.name} | Email: ${user.email}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDuplicates();
