// Notifications service

// Save notification to Firestore
async function saveNotification(notification) {
    try {
        await db.collection('notifications').add(notification);
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn("Notification permission denied. Please update Firestore Security Rules.");
        } else {
            console.error("Error saving notification:", error);
        }
    }
}

// Fetch notifications for a user
async function fetchNotifications(userId) {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        // Handle missing index error
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            console.warn('Firestore index required for notifications. Create it at:', error.message.match(/https:\/\/[^\s]+/)?.[0]);
            // Return empty array until index is created
            return [];
        }
        // Silently handle permission errors (notifications feature may not be set up yet)
        if (error.code !== 'permission-denied') {
            console.error("Error fetching notifications:", error);
        }
        return [];
    }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({ read: true });
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

// Display notifications in UI
function displayNotifications(notifications) {
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');

    if (notifications.length === 0) {
        list.innerHTML = '<div class="empty-notifications">알림이 없습니다.</div>';
        badge.style.display = 'none';
        return;
    }

    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.id}', '${n.type}', '${n.targetId}')">
            <div class="notification-header">
                <span>${new Date(n.createdAt).toLocaleDateString()}</span>
                ${!n.read ? '<span style="color: var(--primary);">●</span>' : ''}
            </div>
            <div class="notification-content">${n.message}</div>
            ${n.type === 'unlock_approved' ? `
                <div class="notification-action">
                    <button class="notification-btn">프로필 보기</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Handle notification click
async function handleNotificationClick(notificationId, type, targetId) {
    await markNotificationAsRead(notificationId);

    // Refresh notifications to update UI
    if (window.currentUser) {
        const notifications = await fetchNotifications(window.currentUser.id);
        displayNotifications(notifications);
    }

    if (type === 'unlock_approved') {
        document.getElementById('notification-modal').style.display = 'none';

        // Fetch the target user and show their profile
        try {
            const userDoc = await db.collection('users').doc(targetId).get();
            if (userDoc.exists) {
                const targetUser = userDoc.data();
                // Trigger event to show profile modal
                window.dispatchEvent(new CustomEvent('showUnlockedProfile', {
                    detail: { user: targetUser }
                }));
            }
        } catch (error) {
            console.error('Error fetching unlocked profile:', error);
            alert('프로필을 불러오는 중 오류가 발생했습니다.');
        }
    }
}

// Export to global scope
window.saveNotification = saveNotification;
window.fetchNotifications = fetchNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.displayNotifications = displayNotifications;
window.handleNotificationClick = handleNotificationClick;
