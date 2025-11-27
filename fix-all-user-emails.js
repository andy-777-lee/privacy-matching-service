const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixAllUserEmails() {
    try {
        console.log('모든 사용자의 이메일을 확인하고 수정합니다...\n');

        // Firestore에서 모든 사용자 가져오기
        const usersSnapshot = await db.collection('users').get();

        console.log(`총 ${usersSnapshot.size}명의 사용자를 찾았습니다.\n`);

        let fixedCount = 0;
        let alreadyCorrectCount = 0;
        let errorCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const uid = userDoc.id;
            const userData = userDoc.data();
            const kakaoId = userData.contactKakao;

            if (!kakaoId) {
                console.log(`⚠️  ${userData.name || uid}: 카카오톡 ID 없음 - 건너뜀`);
                errorCount++;
                continue;
            }

            try {
                // Firebase Auth에서 사용자 정보 가져오기
                const userRecord = await admin.auth().getUser(uid);
                const currentEmail = userRecord.email;

                // 올바른 이메일 생성 (Base64 인코딩)
                const safeKakaoId = btoa(encodeURIComponent(kakaoId))
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=/g, '');
                const correctEmail = `${safeKakaoId}@matching.app`;

                if (currentEmail === correctEmail) {
                    console.log(`✅ ${userData.name || uid} (${kakaoId}): 이미 올바른 형식`);
                    alreadyCorrectCount++;
                } else {
                    console.log(`🔧 ${userData.name || uid} (${kakaoId}):`);
                    console.log(`   이전: ${currentEmail}`);
                    console.log(`   수정: ${correctEmail}`);

                    // 이메일 업데이트
                    await admin.auth().updateUser(uid, {
                        email: correctEmail
                    });

                    console.log(`   ✅ 수정 완료\n`);
                    fixedCount++;
                }

            } catch (error) {
                console.log(`❌ ${userData.name || uid} (${kakaoId}): 오류 - ${error.message}`);
                errorCount++;
            }
        }

        console.log('\n=== 작업 완료 ===');
        console.log(`총 사용자: ${usersSnapshot.size}명`);
        console.log(`수정됨: ${fixedCount}명`);
        console.log(`이미 올바름: ${alreadyCorrectCount}명`);
        console.log(`오류: ${errorCount}명`);

    } catch (error) {
        console.error('❌ 전체 오류 발생:', error.message);
        throw error;
    }
}

// 실행
fixAllUserEmails()
    .then(() => {
        console.log('\n완료!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('실패:', error);
        process.exit(1);
    });
