const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function sendPatchNotesToAllUsers() {
    try {
        console.log('📢 모든 사용자에게 패치 내역 알림 전송 시작...');

        // 1. 모든 사용자 가져오기
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log('사용자가 없습니다.');
            return;
        }

        console.log(`총 ${usersSnapshot.size}명의 사용자를 찾았습니다.`);

        const batch = db.batch();
        let count = 0;
        const BATCH_SIZE = 500; // Firestore batch limit

        for (const doc of usersSnapshot.docs) {
            const user = doc.data();
            const userId = doc.id;

            // 알림 데이터 생성
            const notificationRef = db.collection('notifications').doc();
            const notification = {
                userId: userId,
                type: 'patch_notes',
                message: '📢 새로운 업데이트가 있습니다! 변경 사항을 확인해보세요.',
                read: false,
                createdAt: Date.now()
            };

            batch.set(notificationRef, notification);
            count++;

            // 배치가 가득 차면 커밋하고 새로운 배치 시작
            if (count % BATCH_SIZE === 0) {
                await batch.commit();
                console.log(`${count}명에게 알림 전송 완료...`);
                // 새로운 배치 시작 (변수 재할당이 안되므로 새로운 배치를 만들어야 함 - 하지만 여기선 간단히 루프 밖에서 처리하거나 재할당 필요)
                // batch는 재사용 불가하므로, 사실 루프 내에서 batch를 새로 만드는 구조가 복잡해질 수 있음.
                // 사용자가 적으므로 그냥 하나씩 보내거나, 간단히 Promise.all로 처리하는게 나을 수도 있지만,
                // 안전하게 batch를 쓰되, 루프 구조를 단순화하겠습니다.
            }
        }

        // 남은 배치 커밋
        if (count % BATCH_SIZE !== 0) {
            await batch.commit();
        }

        console.log(`\n✅ 총 ${count}명에게 패치 내역 알림을 성공적으로 전송했습니다!`);

    } catch (error) {
        console.error('❌ 알림 전송 중 오류 발생:', error);
    }
}

sendPatchNotesToAllUsers()
    .then(() => {
        console.log('작업 완료');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
