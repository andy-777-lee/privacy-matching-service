// Database service - Firestore CRUD operations

// In-memory cache for users (avoids sessionStorage quota issues)
let usersCache = {
    data: null,
    timestamp: null,
    duration: 5 * 60 * 1000 // 5 minutes
};

// In-memory cache for unlock requests
let unlockRequestsCache = {
    data: null,
    timestamp: null,
    duration: 2 * 60 * 1000 // 2 minutes (shorter than users since requests change more frequently)
};

// Fetch all users (with in-memory caching)
async function fetchUsers(forceRefresh = false) {
    try {
        // Check cache first
        if (!forceRefresh && usersCache.data && usersCache.timestamp) {
            const now = Date.now();
            if (now - usersCache.timestamp < usersCache.duration) {
                console.log('Returning cached users data (in-memory)');
                return usersCache.data;
            }
        }

        console.log('Fetching users from Firestore...');
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            // Ensure document ID is included
            if (!data.id) {
                data.id = doc.id;
            }
            return data;
        });

        // Remove duplicates by user ID (in case of data inconsistencies)
        const uniqueUsers = Array.from(
            new Map(users.map(user => [user.id, user])).values()
        );

        // Update in-memory cache
        usersCache.data = uniqueUsers;
        usersCache.timestamp = Date.now();
        console.log(`Fetched ${users.length} users, cached ${uniqueUsers.length} unique users in memory`);

        return uniqueUsers;
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

// Fetch unlock requests (filtered by userId if provided)
async function fetchUnlockRequests(userId = null, forceRefresh = false) {
    try {
        if (!userId) {
            // Admin mode: Fetch all requests with caching

            // Check cache first
            if (!forceRefresh && unlockRequestsCache.data && unlockRequestsCache.timestamp) {
                const now = Date.now();
                if (now - unlockRequestsCache.timestamp < unlockRequestsCache.duration) {
                    console.log('Returning cached unlock requests data (in-memory)');
                    return unlockRequestsCache.data;
                }
            }

            console.log('Fetching ALL unlock requests (Admin mode)...');
            const snapshot = await db.collection('unlock_requests').get();
            const requests = snapshot.docs.map(doc => doc.data());

            // Update in-memory cache
            unlockRequestsCache.data = requests;
            unlockRequestsCache.timestamp = Date.now();
            console.log(`Fetched ${requests.length} unlock requests, cached in memory`);

            return requests;
        } else {
            // User mode: Fetch only relevant requests (sent by me OR received by me)
            // Don't cache user-specific requests as they're less frequently accessed
            console.log(`Fetching unlock requests for user ${userId}...`);

            // Firestore doesn't support logical OR in a single query easily for different fields
            // So we run two parallel queries
            const [sentSnapshot, receivedSnapshot] = await Promise.all([
                db.collection('unlock_requests').where('requesterId', '==', userId).get(),
                db.collection('unlock_requests').where('targetId', '==', userId).get()
            ]);

            const sentRequests = sentSnapshot.docs.map(doc => doc.data());
            const receivedRequests = receivedSnapshot.docs.map(doc => doc.data());

            // Merge and deduplicate (though overlap shouldn't exist in this specific case)
            const requestMap = new Map();
            sentRequests.forEach(r => requestMap.set(r.id, r));
            receivedRequests.forEach(r => requestMap.set(r.id, r));

            return Array.from(requestMap.values());
        }
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

// Clear users cache (for debugging)
function clearUsersCache() {
    usersCache.data = null;
    usersCache.timestamp = null;
    console.log('Users cache cleared');
}

// Clear unlock requests cache
function clearUnlockRequestsCache() {
    unlockRequestsCache.data = null;
    unlockRequestsCache.timestamp = null;
    console.log('Unlock requests cache cleared');
}

// Export to global scope
window.fetchUsers = fetchUsers;
window.saveUser = saveUser;
window.fetchUnlockRequests = fetchUnlockRequests;
window.saveUnlockRequest = saveUnlockRequest;
window.fetchUnlockedProfiles = fetchUnlockedProfiles;
window.addUnlockedProfile = addUnlockedProfile;
window.deleteUser = deleteUser;
window.clearUsersCache = clearUsersCache;
window.clearUnlockRequestsCache = clearUnlockRequestsCache;
