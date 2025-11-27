// Check user password in Firestore
const db = firebase.firestore();

async function checkUserPassword() {
    const userId = 'NuEbSYrfRaR78GgUJEsmUEFmsEf2';

    try {
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('사용자 정보:', {
                이름: userData.name,
                이메일: userData.email,
                카카오톡ID: userData.contactKakao,
                비밀번호필드존재: !!userData.password,
                비밀번호값: userData.password
            });
        } else {
            console.log('사용자를 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('오류:', error);
    }
}

checkUserPassword();
