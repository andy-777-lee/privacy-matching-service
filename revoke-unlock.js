const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function revokeUnlock(user1Name, user2Name) {
    try {
        console.log(`${user1Name}와 ${user2Name}의 프로필 공개 취소 중...\n`);

        // 1. 사용자 찾기
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const user1 = users.find(u => u.name === user1Name);
        const user2 = users.find(u => u.name === user2Name);

        if (!user1) {
            console.error(`❌ ${user1Name} 사용자를 찾을 수 없습니다.`);
            return;
        }

        if (!user2) {
            console.error(`❌ ${user2Name} 사용자를 찾을 수 없습니다.`);
            return;
        }

        console.log(`✅ ${user1Name} (ID: ${user1.id})`);
        console.log(`✅ ${user2Name} (ID: ${user2.id})\n`);

        // 2. unlockedProfiles 컬렉션에서 삭제
        console.log('unlockedProfiles 컬렉션에서 삭제 중...');

        // user1 -> user2 unlock 삭제
        const unlock1Query = await db.collection('unlockedProfiles')
            .where('userId', '==', user1.id)
            .where('unlockedUserId', '==', user2.id)
            .get();

        for (const doc of unlock1Query.docs) {
            await doc.ref.delete();
            console.log(`✅ ${user1Name} -> ${user2Name} unlock 삭제됨`);
        }

        // user2 -> user1 unlock 삭제
        const unlock2Query = await db.collection('unlockedProfiles')
            .where('userId', '==', user2.id)
            .where('unlockedUserId', '==', user1.id)
            .get();

        for (const doc of unlock2Query.docs) {
            await doc.ref.delete();
            console.log(`✅ ${user2Name} -> ${user1Name} unlock 삭제됨`);
        }

        // 3. unlock_requests 컬렉션에서 관련 요청 찾기 및 상태 변경
        console.log('\nunlock_requests 컬렉션 확인 중...');

        const requestsSnapshot = await db.collection('unlock_requests').get();
        const requests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const relatedRequests = requests.filter(r =>
            (r.requesterId === user1.id && r.targetId === user2.id) ||
            (r.requesterId === user2.id && r.targetId === user1.id)
        );

        for (const request of relatedRequests) {
            if (request.status === 'approved') {
                // 승인된 요청을 pending으로 변경
                await db.collection('unlock_requests').doc(request.id).update({
                    status: 'pending',
                    reviewedAt: admin.firestore.FieldValue.delete(),
                    adminApprovedAt: admin.firestore.FieldValue.delete(),
                    targetApprovalStatus: admin.firestore.FieldValue.delete(),
                    targetApprovedAt: admin.firestore.FieldValue.delete()
                });
                console.log(`✅ 요청 ID ${request.id} 상태를 pending으로 변경`);
            }
        }

        console.log('\n✅ 프로필 공개가 취소되었습니다!');
        console.log(`${user1Name}와 ${user2Name}는 이제 서로의 프로필을 볼 수 없습니다.`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
        throw error;
    }
}

// 실행
revokeUnlock('테스트 A', '테스트 B')
    .then(() => {
        console.log('\n완료!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
