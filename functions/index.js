const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Increment user count when a new user is created
exports.incrementUserCount = functions.firestore
    .document('users/{userId}')
    .onCreate(async (snap, context) => {
        const statsRef = db.collection('stats').doc('userCount');

        try {
            await db.runTransaction(async (transaction) => {
                const statsDoc = await transaction.get(statsRef);

                if (!statsDoc.exists) {
                    // Initialize if doesn't exist
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

// Decrement user count when a user is deleted
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
                        count: Math.max(0, currentCount - 1), // Prevent negative counts
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            console.log('User count decremented');
        } catch (error) {
            console.error('Error decrementing user count:', error);
        }
    });
