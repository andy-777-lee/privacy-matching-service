const admin = require('firebase-admin');

// Firebase Admin SDK 초기화
// 서비스 계정 키 파일이 필요합니다
// Firebase Console > Project Settings > Service Accounts > Generate New Private Key

// 방법 1: 서비스 계정 키 파일 사용
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// 방법 2: 환경 변수 사용 (권장)
// admin.initializeApp({
//     credential: admin.credential.applicationDefault()
// });

async function resetUserPassword(uid, newPassword) {
    try {
        console.log(`사용자 ${uid}의 비밀번호를 변경합니다...`);

        // 비밀번호 업데이트
        await admin.auth().updateUser(uid, {
            password: newPassword
        });

        console.log('✅ 비밀번호가 성공적으로 변경되었습니다!');
        console.log(`새 비밀번호: ${newPassword}`);

        // 사용자 정보 확인
        const userRecord = await admin.auth().getUser(uid);
        console.log('\n사용자 정보:');
        console.log('- UID:', userRecord.uid);
        console.log('- Email:', userRecord.email);
        console.log('- 생성일:', new Date(userRecord.metadata.creationTime).toLocaleString('ko-KR'));
        console.log('- 마지막 로그인:', userRecord.metadata.lastSignInTime ? new Date(userRecord.metadata.lastSignInTime).toLocaleString('ko-KR') : '없음');

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        throw error;
    }
}

// 사용법
const USER_UID = 'NuEbSYrfRaR78GgUJEsmUEFmsEf2';
const NEW_PASSWORD = '000000'; // 사용자는 0000 입력

// 실행
resetUserPassword(USER_UID, NEW_PASSWORD)
    .then(() => {
        console.log('\n완료!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
