// Remove duplicate user profiles from Firestore
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// List of duplicate user IDs to remove
const DUPLICATES_TO_REMOVE = [
    'iYDbFcyLB1Zc3Q1Qh7COrxvPqwW2', // 구민수 (no preferences - DELETE)
    'pRAUfGvSaaaC47VyMWuNzZPMHcB2'  // 박혜림 (created later - DELETE)
];

async function removeDuplicates() {
    try {
        console.log('🔍 Checking users before deletion...\n');

        // Show user info before deletion
        for (const userId of DUPLICATES_TO_REMOVE) {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                const data = doc.data();
                console.log(`❌ Will DELETE: ${data.name} (ID: ${userId})`);
                console.log(`   Email: ${data.email || 'N/A'}`);
                console.log(`   Birth Year: ${data.birthYear || 'N/A'}`);
                console.log('');
            } else {
                console.log(`⚠️  User ${userId} not found\n`);
            }
        }

        // Ask for confirmation
        console.log('⚠️  WARNING: This will permanently delete the above users!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('🗑️  Starting deletion...\n');

        // Delete users
        for (const userId of DUPLICATES_TO_REMOVE) {
            try {
                await db.collection('users').doc(userId).delete();
                console.log(`✅ Deleted user: ${userId}`);
            } catch (error) {
                console.error(`❌ Error deleting ${userId}:`, error.message);
            }
        }

        console.log('\n✅ Duplicate removal complete!');
        console.log('\n📊 Verifying remaining users...\n');

        // Verify remaining users
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        // Group by name
        const nameGroups = {};
        users.forEach(user => {
            if (!nameGroups[user.name]) {
                nameGroups[user.name] = [];
            }
            nameGroups[user.name].push(user.id);
        });

        // Show any remaining duplicates
        let foundDuplicates = false;
        for (const [name, ids] of Object.entries(nameGroups)) {
            if (ids.length > 1) {
                foundDuplicates = true;
                console.log(`⚠️  Still duplicate: ${name} (${ids.length} profiles)`);
                ids.forEach(id => console.log(`   - ${id}`));
            }
        }

        if (!foundDuplicates) {
            console.log('✅ No duplicate names found!');
        }

        console.log(`\n📈 Total users: ${users.length}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

removeDuplicates();
