const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findUserByUID(uid) {
    try {
        console.log(`사용자 UID: ${uid} 정보 조회 중...\n`);

        // Firebase Auth에서 사용자 정보 가져오기
        const userRecord = await admin.auth().getUser(uid);
        console.log('=== Firebase Auth 정보 ===');
        console.log('UID:', userRecord.uid);
        console.log('Email:', userRecord.email);
        console.log('생성일:', new Date(userRecord.metadata.creationTime).toLocaleString('ko-KR'));
        console.log('마지막 로그인:', userRecord.metadata.lastSignInTime ? new Date(userRecord.metadata.lastSignInTime).toLocaleString('ko-KR') : '없음');

        // Firestore에서 사용자 정보 가져오기
        const userDoc = await db.collection('users').doc(uid).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('\n=== Firestore 사용자 정보 ===');
            console.log('이름:', userData.name);
            console.log('카카오톡 ID:', userData.contactKakao);
            console.log('이메일:', userData.email);
            console.log('나이:', userData.age);
            console.log('성별:', userData.gender);

            // 카카오톡 ID로 로그인 이메일 생성
            if (userData.contactKakao) {
                const safeKakaoId = btoa(encodeURIComponent(userData.contactKakao))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
                const loginEmail = `${safeKakaoId}@matching.app`;

                console.log('\n=== 로그인 정보 ===');
                console.log('로그인 시 입력할 카카오톡 ID:', userData.contactKakao);
                console.log('로그인 시 입력할 비밀번호: 0000');
                console.log('생성된 로그인 이메일:', loginEmail);
                console.log('Firebase Auth 이메일:', userRecord.email);
                console.log('이메일 일치 여부:', loginEmail === userRecord.email ? '✅ 일치' : '❌ 불일치');
            }
        } else {
            console.log('\n⚠️ Firestore에 사용자 데이터가 없습니다.');
        }

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        throw error;
    }
}

// 실행
const USER_UID = 'NuEbSYrfRaR78GgUJEsmUEFmsEf2';

findUserByUID(USER_UID)
    .then(() => {
        console.log('\n완료!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
