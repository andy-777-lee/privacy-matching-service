const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCreatedAt() {
    try {
        console.log('사용자 createdAt 타임스탬프 확인:\n');

        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        users.forEach((user, index) => {
            console.log(`${index + 1}. 이름: ${user.name || '없음'} (ID: ${user.id})`);
            console.log(`   카카오톡: ${user.contactKakao || '없음'}`);

            if (user.createdAt) {
                const createdDate = new Date(user.createdAt);
                const now = Date.now();
                const hoursSinceCreation = (now - user.createdAt) / (1000 * 60 * 60);
                const isNew = hoursSinceCreation < 24;

                console.log(`   ✅ createdAt: ${createdDate.toLocaleString('ko-KR')}`);
                console.log(`   ⏱️  가입 후 경과 시간: ${hoursSinceCreation.toFixed(1)}시간`);
                console.log(`   ${isNew ? '🆕 NEW 배지 표시됨' : '⏳ NEW 배지 미표시 (24시간 경과)'}`);
            } else {
                console.log(`   ❌ createdAt 없음 - 타임스탬프가 저장되지 않았습니다!`);
            }
            console.log('');
        });

        console.log(`총 ${users.length}명의 사용자`);

        const usersWithCreatedAt = users.filter(u => u.createdAt);
        const usersWithoutCreatedAt = users.filter(u => !u.createdAt);

        console.log(`\n📊 통계:`);
        console.log(`   createdAt 있음: ${usersWithCreatedAt.length}명`);
        console.log(`   createdAt 없음: ${usersWithoutCreatedAt.length}명`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
        throw error;
    }
}

// 실행
checkCreatedAt()
    .then(() => {
        console.log('\n완료!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
