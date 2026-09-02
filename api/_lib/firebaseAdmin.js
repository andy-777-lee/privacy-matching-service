// Shared Firebase Admin initializer for Vercel serverless functions.
// Requires env var FIREBASE_SERVICE_ACCOUNT (the service account JSON as a string).
const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

module.exports = { admin, db: admin.firestore() };
