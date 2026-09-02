// POST /api/set-pin  { idToken, pin }
// Stores a 4-digit login PIN for the caller. Used at registration and whenever
// a user re-sets their PIN after signing in with an SMS code.
//
// The hash lives in `user_auth/{uid}`, which no client can read or write — the
// catch-all deny rule in firestore.rules covers it, so only the Admin SDK
// reaches it.
const { admin, db } = require('./_lib/firebaseAdmin');
const { PIN_RE, isWeakPin, makePinRecord } = require('./_lib/pin');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idToken, pin } = req.body || {};
        if (!idToken || !pin) {
            return res.status(400).json({ error: '잘못된 요청입니다.' });
        }

        const pinStr = String(pin).trim();
        if (!PIN_RE.test(pinStr)) {
            return res.status(400).json({ error: '비밀번호는 숫자 4자리여야 합니다.' });
        }
        if (isWeakPin(pinStr)) {
            return res.status(400).json({ error: '너무 쉬운 비밀번호입니다. 다른 숫자를 사용해주세요.' });
        }

        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid;
        if (!uid.startsWith('phone:')) {
            return res.status(403).json({ error: '휴대폰 인증 계정만 사용할 수 있습니다.' });
        }

        const { salt, hash } = makePinRecord(pinStr);
        await db.collection('user_auth').doc(uid).set({
            salt,
            hash,
            updatedAt: Date.now(),
            failCount: 0,
            lockedUntil: 0
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('set-pin error:', error);
        return res.status(500).json({ error: '비밀번호 설정 중 오류가 발생했습니다.' });
    }
};
