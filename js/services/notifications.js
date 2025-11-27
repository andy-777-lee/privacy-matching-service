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
async function displayNotifications(notifications) {
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

    // Fetch all unlock requests to check status
    let requestsMap = {};
    if (notifications.some(n => n.type === 'approval_request')) {
        try {
            const requests = await fetchUnlockRequests();
            requests.forEach(r => {
                requestsMap[r.id] = r;
            });
        } catch (error) {
            console.error('Error fetching unlock requests:', error);
        }
    }

    list.innerHTML = notifications.map(n => {
        let actionButtons = '';

        if (n.type === 'unlock_approved') {
            actionButtons = `
                <div class="notification-action">
                    <button class="notification-btn">프로필 보기</button>
                </div>
            `;
        } else if (n.type === 'approval_request') {
            const request = requestsMap[n.requestId];

            if (request && request.status === 'approved') {
                actionButtons = `
                    <div class="notification-action" style="margin-top: 0.5rem;">
                        <div style="padding: 0.75rem; background: rgba(78, 205, 196, 0.2); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 8px; color: #4ECDC4; text-align: center;">
                            ✅ 승인되었습니다
                        </div>
                    </div>
                `;
            } else if (request && request.status === 'rejected') {
                actionButtons = `
                    <div class="notification-action" style="margin-top: 0.5rem;">
                        <div style="padding: 0.75rem; background: rgba(255, 107, 107, 0.2); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; color: #FF6B6B; text-align: center;">
                            ❌ 거절되었습니다
                        </div>
                    </div>
                `;
            } else {
                // Still pending - show buttons
                actionButtons = `
                    <div class="notification-action" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <button class="notification-btn" onclick="event.stopPropagation(); showRequesterProfile('${n.requesterId}', '${n.requestId}')" style="flex: 1; background: #667eea;">
                            요청자 프로필 보기
                        </button>
                    </div>
                    <div class="notification-action" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <button class="notification-btn" onclick="event.stopPropagation(); handleTargetApproval('${n.requestId}', true)" style="flex: 1; background: #4ECDC4;">
                            승인
                        </button>
                        <button class="notification-btn" onclick="event.stopPropagation(); handleTargetApproval('${n.requestId}', false)" style="flex: 1; background: #FF6B6B;">
                            거절
                        </button>
                    </div>
                `;
            }
        }

        return `
            <div class="notification-item ${n.read ? '' : 'unread'}" ${n.type !== 'approval_request' ? `onclick="handleNotificationClick('${n.id}', '${n.type}', '${n.targetId || ''}')"` : ''}>
                <div class="notification-header">
                    <span>${new Date(n.createdAt).toLocaleDateString()}</span>
                    ${!n.read ? '<span style="color: var(--primary);">●</span>' : ''}
                </div>
                <div class="notification-content">${n.message}</div>
                ${actionButtons}
            </div>
        `;
    }).join('');
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
        document.getElementById('notification-modal').classList.remove('active');

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

// Show requester's profile for approval decision
async function showRequesterProfile(requesterId, requestId) {
    try {
        const userDoc = await db.collection('users').doc(requesterId).get();
        if (userDoc.exists) {
            const requesterUser = userDoc.data();

            // Close notification modal
            document.getElementById('notification-modal').classList.remove('active');

            // Show profile modal with approval buttons
            window.dispatchEvent(new CustomEvent('showRequesterProfile', {
                detail: { user: requesterUser, requestId: requestId }
            }));
        }
    } catch (error) {
        console.error('Error fetching requester profile:', error);
        alert('프로필을 불러오는 중 오류가 발생했습니다.');
    }
}

// Handle target user's approval/rejection
async function handleTargetApproval(requestId, approve) {
    if (approve) {
        if (confirm('이 사용자의 프로필 공개 요청을 승인하시겠습니까?\n승인하면 양쪽 모두 서로의 프로필을 볼 수 있습니다.')) {
            await targetApproveRequest(requestId);

            // Refresh notifications to update UI
            if (window.currentUser) {
                const notifications = await fetchNotifications(window.currentUser.id);
                await displayNotifications(notifications);
            }
        }
    } else {
        if (confirm('이 사용자의 프로필 공개 요청을 거절하시겠습니까?')) {
            await targetRejectRequest(requestId);

            // Refresh notifications to update UI
            if (window.currentUser) {
                const notifications = await fetchNotifications(window.currentUser.id);
                await displayNotifications(notifications);
            }
        }
    }
}

// Export to global scope
window.saveNotification = saveNotification;
window.fetchNotifications = fetchNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.displayNotifications = displayNotifications;
window.handleNotificationClick = handleNotificationClick;
window.showRequesterProfile = showRequesterProfile;
window.handleTargetApproval = handleTargetApproval;
