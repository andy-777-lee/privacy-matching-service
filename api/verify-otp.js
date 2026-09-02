// POST /api/verify-otp  { phone, code }
// Verifies the OTP and, on success, returns a Firebase custom token for sign-in.
const { admin, db } = require('./_lib/firebaseAdmin');
const { normalizePhone } = require('./_lib/sms');

const MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const phone = normalizePhone((req.body && req.body.phone) || '');
        const code = String((req.body && req.body.code) || '').trim();

        if (!phone || !code) {
            return res.status(400).json({ error: '잘못된 요청입니다.' });
        }

        const otpRef = db.collection('otp_codes').doc(phone);
        const snap = await otpRef.get();

        if (!snap.exists) {
            return res.status(400).json({ error: '인증번호를 먼저 요청해주세요.' });
        }

        const data = snap.data();

        if (Date.now() > data.expiresAt) {
            await otpRef.delete();
            return res.status(400).json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' });
        }

        if ((data.attempts || 0) >= MAX_ATTEMPTS) {
            await otpRef.delete();
            return res.status(429).json({ error: '시도 횟수를 초과했습니다. 다시 요청해주세요.' });
        }

        if (data.code !== code) {
            await otpRef.update({ attempts: (data.attempts || 0) + 1 });
            return res.status(400).json({ error: '인증번호가 일치하지 않습니다.' });
        }

        // Success — consume the code and mint a custom token
        await otpRef.delete();

        const uid = `phone:${phone}`;
        const customToken = await admin.auth().createCustomToken(uid, { provider: 'phone', phone });

        return res.status(200).json({ customToken, phone });
    } catch (error) {
        console.error('verify-otp error:', error);
        return res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다.' });
    }
};
