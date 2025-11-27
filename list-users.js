const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listUsers() {
    try {
        console.log('모든 사용자 목록:\n');

        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        users.forEach((user, index) => {
            console.log(`${index + 1}. 이름: ${user.name || '없음'} (ID: ${user.id})`);
            console.log(`   카카오톡: ${user.contactKakao || '없음'}`);
            console.log(`   이메일: ${user.email || '없음'}`);
            console.log('');
        });

        console.log(`총 ${users.length}명의 사용자`);

    } catch (error) {
        console.error('❌ 오류 발생:', error);
        throw error;
    }
}

// 실행
listUsers()
    .then(() => {
        console.log('\n완료!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
