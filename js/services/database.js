// Database service - Firestore CRUD operations

// Fetch all users
async function fetchUsers() {
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => doc.data());
        console.log('Fetched users from Firestore:', users);
        users.forEach(user => {
            console.log(`User ${user.contactKakao} - password field:`, user.password);
        });
        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

// Save user with partial update (merge) to avoid overwriting whole document
async function saveUser(user) {
    try {
        console.log('Saving user to Firestore (merge):', user.id);
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

// Export to global scope
window.fetchUsers = fetchUsers;
window.saveUser = saveUser;
window.fetchUnlockRequests = fetchUnlockRequests;
window.saveUnlockRequest = saveUnlockRequest;
window.fetchUnlockedProfiles = fetchUnlockedProfiles;
