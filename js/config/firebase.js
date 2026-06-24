// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCtCaLngksFACS5bVYFIm7wCuHz79B2oRA",
    authDomain: "privacy-matching-andylee.firebaseapp.com",
    projectId: "privacy-matching-andylee",
    storageBucket: "privacy-matching-andylee.firebasestorage.app",
    messagingSenderId: "868406980562",
    appId: "1:868406980562:web:c87fcd946ed7a06df8a20b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Firebase Cloud Messaging (only in supported browsers)
let messaging = null;
if (typeof firebase.messaging !== 'undefined' && firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
}

// Firebase Functions (for calling Cloud Functions)
const functions = firebase.functions();

// Export for use in other modules
window.db = db;
window.auth = auth;
window.messaging = messaging;
window.functions = functions;
