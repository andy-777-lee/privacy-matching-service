const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function fixUserEmail(uid, kakaoId) {
    try {
        console.log(`사용자 ${uid}의 이메일을 수정합니다...`);
        console.log(`카카오톡 ID: ${kakaoId}\n`);

        // 올바른 이메일 생성 (Base64 인코딩)
        const safeKakaoId = btoa(encodeURIComponent(kakaoId))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        const correctEmail = `${safeKakaoId}@matching.app`;

        console.log('생성된 이메일:', correctEmail);

        // Firebase Auth 이메일 업데이트
        await admin.auth().updateUser(uid, {
            email: correctEmail
        });

        console.log('✅ 이메일이 성공적으로 변경되었습니다!');

        // 사용자 정보 확인
        const userRecord = await admin.auth().getUser(uid);
        console.log('\n업데이트된 사용자 정보:');
        console.log('- UID:', userRecord.uid);
        console.log('- Email:', userRecord.email);
        console.log('- 생성일:', new Date(userRecord.metadata.creationTime).toLocaleString('ko-KR'));

        console.log('\n=== 로그인 정보 ===');
        console.log('카카오톡 ID: positiver9930');
        console.log('비밀번호: 0000');

    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        throw error;
    }
}

// 실행
const USER_UID = 'NuEbSYrfRaR78GgUJEsmUEFmsEf2';
const KAKAO_ID = 'positiver9930';

fixUserEmail(USER_UID, KAKAO_ID)
    .then(() => {
        console.log('\n완료!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
