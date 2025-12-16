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
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // [System Notification] Injection removed at user request


        return notifications;
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
        if (notificationId.startsWith('sys_')) {
            // Local system notification
            if (window.currentUser) {
                localStorage.setItem(`notif_read_${window.currentUser.id}_${notificationId}`, 'true');
            }
            return;
        }
        await db.collection('notifications').doc(notificationId).update({ read: true });
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

// Format timestamp for notifications
function formatNotificationTime(timestamp) {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffMs = now - notificationTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return '방금 전';
    } else if (diffMins < 60) {
        return `${diffMins}분 전`;
    } else if (diffHours < 24) {
        return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
        return `${diffDays}일 전`;
    } else {
        // For older notifications, show date and time
        const month = notificationTime.getMonth() + 1;
        const day = notificationTime.getDate();
        const hours = notificationTime.getHours();
        const minutes = notificationTime.getMinutes().toString().padStart(2, '0');
        return `${month}월 ${day}일 ${hours}:${minutes}`;
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
            // Pass currentUser.id to filter requests (optimization)
            const requests = await fetchUnlockRequests(window.currentUser ? window.currentUser.id : null);
            requests.forEach(r => {
                requestsMap[r.id] = r;
            });
        } catch (error) {
            console.error('Error fetching unlock requests:', error);
        }
    }

    list.innerHTML = notifications.map(n => {
        let actionButtons = '';

        if (n.type === 'unlock_approved' || n.type === 'mutual_approval_complete') {
            actionButtons = `
                <div class="notification-action">
                    <button class="notification-btn">프로필 보기</button>
                </div>
            `;
        } else if (n.action === 'view_update_history') {
            actionButtons = `
                <div class="notification-action">
                    <button class="notification-btn" onclick="event.stopPropagation(); document.getElementById('patch-notes-modal').classList.add('active'); document.getElementById('patch-notes-modal').style.display = 'flex';">내역 보기</button>
                </div>
            `;
        } else if (n.type === 'patch_notes') {
            actionButtons = `
                <div class="notification-action">
                    <button class="notification-btn" onclick="event.stopPropagation(); document.getElementById('patch-notes-modal').classList.add('active'); document.getElementById('patch-notes-modal').style.display = 'flex';">내역 보기</button>
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
            } else if (request && request.status === 'waiting_mutual') {
                actionButtons = `
                    <div class="notification-action" style="margin-top: 0.5rem;">
                        <div style="padding: 0.75rem; background: rgba(102, 126, 234, 0.2); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 8px; color: #667eea; text-align: center;">
                            ⏳ 승인 완료 (상대방 최종 승인 대기)
                        </div>
                    </div>
                `;
            } else {
                // Still pending - show profile view button
                actionButtons = `
                    <div class="notification-action" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <button class="notification-btn" onclick="event.stopPropagation(); showRequesterProfile('${n.requesterId}', '${n.requestId}')" style="flex: 1; background: #667eea;">
                            프로필 보기
                        </button>
                    </div>
                `;
            }
        } else if (n.type === 'mutual_approval_needed') {
            const request = requestsMap[n.requestId];

            if (request && request.status === 'approved') {
                actionButtons = `
                    <div class="notification-action" style="margin-top: 0.5rem;">
                        <div style="padding: 0.75rem; background: rgba(78, 205, 196, 0.2); border: 1px solid rgba(78, 205, 196, 0.3); border-radius: 8px; color: #4ECDC4; text-align: center;">
                            ✅ 최종 승인 완료
                        </div>
                    </div>
                `;
            } else if (request && request.status === 'rejected') {
                actionButtons = `
                    <div class="notification-action" style="margin-top: 0.5rem;">
                        <div style="padding: 0.75rem; background: rgba(255, 107, 107, 0.2); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 8px; color: #FF6B6B; text-align: center;">
                            ❌ 거절됨
                        </div>
                    </div>
                `;
            } else {
                // Still waiting_mutual - show profile view button to make final decision
                actionButtons = `
                    <div class="notification-action" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <button class="notification-btn" onclick="event.stopPropagation(); showTargetProfileForFinalApproval('${n.targetId}', '${n.requestId}')" style="flex: 1; background: #667eea;">
                            프로필 보기
                        </button>
                    </div>
                `;
            }
        }

        // Display request message if available
        let messageContent = n.message;
        if (n.type === 'approval_request' && n.requestMessage) {
            messageContent = `
                <div>${n.message}</div>
                <div style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(102, 126, 234, 0.1); border-left: 3px solid #667eea; border-radius: 4px; font-style: italic; color: var(--text-secondary);">
                    "${n.requestMessage}"
                </div>
            `;
        } else if (n.message && n.message.includes('💌 메시지:')) {
            // Format mutual approval complete message with user's message
            const parts = n.message.split('\n\n💌 메시지:');
            if (parts.length === 2) {
                const baseMsg = parts[0];
                const userMsg = parts[1].replace(/^"|"$/g, '').trim();
                messageContent = `
                    <div>${baseMsg}</div>
                    <div style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(78, 205, 196, 0.1); border-left: 3px solid #4ECDC4; border-radius: 4px;">
                        <div style="font-style: italic; color: var(--text-secondary);">"${userMsg}"</div>
                    </div>
                `;
            }
        }

        return `
            <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.id}', '${n.type}', '${n.targetId || ''}')">
                <div class="notification-header">
                    <span>${formatNotificationTime(n.createdAt)}</span>
                    ${!n.read ? '<span style="color: var(--primary);">●</span>' : ''}
                </div>
                <div class="notification-content">${messageContent}</div>
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

        // Check for view_update_history action
        const clickedNotification = notifications.find(n => n.id === notificationId);
        if (type === 'patch_notes' || (clickedNotification && clickedNotification.action === 'view_update_history')) {
            document.getElementById('patch-notes-modal').classList.add('active');
            document.getElementById('patch-notes-modal').style.display = 'flex';
            return;
        }
    }

    if (type === 'patch_notes') {
        document.getElementById('patch-notes-modal').classList.add('active');
        document.getElementById('patch-notes-modal').style.display = 'flex';
    } else if (type === 'unlock_approved' || type === 'mutual_approval_complete') {
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
async function handleTargetApproval(requestId, approve, notificationId) {
    if (approve) {
        if (confirm('이 사용자의 프로필 공개 요청을 승인하시겠습니까?\n승인하면 양쪽 모두 서로의 프로필을 볼 수 있습니다.')) {
            await targetApproveRequest(requestId);

            // Mark notification as read if ID is provided
            if (notificationId) {
                await markNotificationAsRead(notificationId);
            }

            // Refresh notifications to update UI
            if (window.currentUser) {
                const notifications = await fetchNotifications(window.currentUser.id);
                await displayNotifications(notifications);
            }
        }
    } else {
        if (confirm('이 사용자의 프로필 공개 요청을 거절하시겠습니까?')) {
            await targetRejectRequest(requestId);

            // Mark notification as read if ID is provided
            if (notificationId) {
                await markNotificationAsRead(notificationId);
            }

            // Refresh notifications to update UI
            if (window.currentUser) {
                const notifications = await fetchNotifications(window.currentUser.id);
                await displayNotifications(notifications);
            }
        }
    }
}

// Show target user's profile for final approval decision (requester's perspective)
async function showTargetProfileForFinalApproval(targetId, requestId) {
    try {
        const userDoc = await db.collection('users').doc(targetId).get();
        if (userDoc.exists) {
            const targetUser = userDoc.data();

            // Close notification modal
            document.getElementById('notification-modal').classList.remove('active');

            // Show profile modal with final approval buttons
            window.dispatchEvent(new CustomEvent('showTargetProfileForFinalApproval', {
                detail: { user: targetUser, requestId: requestId }
            }));
        }
    } catch (error) {
        console.error('Error fetching target profile:', error);
        alert('프로필을 불러오는 중 오류가 발생했습니다.');
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
window.showTargetProfileForFinalApproval = showTargetProfileForFinalApproval;
