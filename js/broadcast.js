
// Broadcast Notification Feature
window.broadcastUpdateNotification = async function () {
    if (!confirm('모든 사용자에게 이번 업데이트 내역 알림을 보내시겠습니까?')) return;

    try {
        const users = await fetchUsers(); // Fetch all users (admin privileges assumed)
        const batch = db.batch();
        const now = Date.now();
        let count = 0;
        let batchCount = 0;
        let batchIndex = 0;

        // Process in chunks of 450 (Firestore limit is 500)
        const chunks = [];
        for (let i = 0; i < users.length; i += 450) {
            chunks.push(users.slice(i, i + 450));
        }

        for (const chunk of chunks) {
            const currentBatch = db.batch();
            chunk.forEach(user => {
                const ref = db.collection('notifications').doc();
                currentBatch.set(ref, {
                    userId: user.id,
                    type: 'system',
                    message: '새로운 업데이트가 있습니다! 변경 사항을 확인해보세요.',
                    read: false,
                    createdAt: now,
                    relatedId: 'update_20241216',
                    action: 'view_update_history' // Special action to open update modal
                });
                count++;
            });
            await currentBatch.commit();
        }

        alert(`총 ${count}명에게 업데이트 알림을 성공적으로 발송했습니다!`);
    } catch (error) {
        console.error('Error broadcasting notification:', error);
        alert('알림 발송 중 오류가 발생했습니다: ' + error.message);
    }
};
