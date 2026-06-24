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

// Export for use in other modules
window.db = db;
window.auth = auth;
