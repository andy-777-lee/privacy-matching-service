// Database service - Firestore CRUD operations

// Fetch all users
async function fetchUsers() {
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => doc.data());
        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

// Save user with partial update (merge) to avoid overwriting whole document
async function saveUser(user) {
    try {
        // Use merge:true so only provided fields are updated
        await db.collection('users').doc(user.id).set(user, { merge: true });
        console.log('User saved (merged) successfully');
    } catch (error) {
        console.error("Error saving user:", error);
        alert('저장 중 오류가 발생했습니다.');
    }
}

// Fetch unlock requests
async function fetchUnlockRequests() {
    try {
        const snapshot = await db.collection('unlock_requests').get();
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error fetching requests:", error);
        return [];
    }
}

// Save unlock request
async function saveUnlockRequest(request) {
    try {
        await db.collection('unlock_requests').doc(request.id).set(request);
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn("Unlock request permission denied. Please update Firestore Security Rules.");
            alert('권한 오류: 관리자에게 문의하세요. (Firestore Rules Update Required)');
        } else {
            console.error("Error saving request:", error);
            alert('요청 저장 중 오류가 발생했습니다.');
        }
    }
}

// Fetch unlocked profiles for a user
async function fetchUnlockedProfiles(userId) {
    try {
        const doc = await db.collection('unlockedProfiles').doc(userId).get();
        if (doc.exists) {
            return doc.data().unlocked || [];
        }
        return [];
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn("Unlocked profiles permission denied. Please update Firestore Security Rules.");
        } else {
            console.error("Error fetching unlocked profiles:", error);
        }
        return [];
    }
}

// Add unlocked profile for a user
async function addUnlockedProfile(userId, targetId) {
    try {
        const docRef = db.collection('unlockedProfiles').doc(userId);
        const doc = await docRef.get();

        let unlocked = [];
        if (doc.exists) {
            unlocked = doc.data().unlocked || [];
        }

        // Add targetId if not already in the list
        if (!unlocked.includes(targetId)) {
            unlocked.push(targetId);
            await docRef.set({ unlocked }, { merge: true });
            console.log(`Added ${targetId} to unlocked profiles for user ${userId}`);
        }
    } catch (error) {
        console.error("Error adding unlocked profile:", error);
        throw error;
    }
}

// Delete user
async function deleteUser(userId) {
    try {
        // Delete Firestore document
        await db.collection('users').doc(userId).delete();
        console.log(`User ${userId} deleted from Firestore successfully`);

        // Note: Firebase Auth account cannot be deleted from client-side
        // Admin must delete it manually from Firebase Console
        console.warn(`⚠️ Firebase Auth account for user ${userId} still exists.`);
        console.warn('Admin must delete it manually from Firebase Console:');
        console.warn('https://console.firebase.google.com/project/privacy-matching-andylee/authentication/users');

        return true;
    } catch (error) {
        console.error("Error deleting user:", error);
        alert('회원 삭제 중 오류가 발생했습니다.');
        return false;
    }
}

// Export to global scope
window.fetchUsers = fetchUsers;
window.saveUser = saveUser;
window.fetchUnlockRequests = fetchUnlockRequests;
window.saveUnlockRequest = saveUnlockRequest;
window.fetchUnlockedProfiles = fetchUnlockedProfiles;
window.addUnlockedProfile = addUnlockedProfile;
window.deleteUser = deleteUser;
