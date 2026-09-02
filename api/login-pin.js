// POST /api/login-pin  { phone, pin }
// Signs a returning user in with their phone number and 4-digit PIN, so routine
// logins cost no SMS. On success a Firebase custom token is returned, exactly
// like /api/verify-otp.
//
// A 4-digit PIN is only 10,000 combinations, so failures are counted per
// account and the account locks briefly once they pile up. Signing in with an
// SMS code clears the lock (see verify-otp.js), which keeps users from being
// stranded.
const { admin, db } = require('./_lib/firebaseAdmin');
const { normalizePhone } = require('./_lib/sms');
const { PIN_RE, verifyPin } = require('./_lib/pin');

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const phone = normalizePhone((req.body && req.body.phone) || '');
        const pin = String((req.body && req.body.pin) || '').trim();

        if (!/^01[0-9]{8,9}$/.test(phone) || !PIN_RE.test(pin)) {
            return res.status(400).json({ error: '휴대폰 번호와 비밀번호 4자리를 확인해주세요.' });
        }

        const uid = `phone:${phone}`;
        const ref = db.collection('user_auth').doc(uid);
        const snap = await ref.get();

        // Identical response for "no such account" and "wrong PIN", so this
        // endpoint cannot be used to discover who is registered.
        const generic = { error: '휴대폰 번호 또는 비밀번호가 일치하지 않습니다.' };
        if (!snap.exists) {
            return res.status(401).json(generic);
        }

        const record = snap.data();
        const now = Date.now();

        if (record.lockedUntil && now < record.lockedUntil) {
            const wait = Math.ceil((record.lockedUntil - now) / 60000);
            return res.status(429).json({
                error: `비밀번호를 여러 번 틀렸습니다. ${wait}분 후에 다시 시도하거나 인증번호로 로그인해주세요.`
            });
        }

        if (!verifyPin(pin, record)) {
            const failCount = (record.failCount || 0) + 1;
            if (failCount >= MAX_FAILS) {
                await ref.update({ failCount: 0, lockedUntil: now + LOCK_MS });
                return res.status(429).json({
                    error: '비밀번호를 5회 틀렸습니다. 10분 후에 다시 시도하거나 인증번호로 로그인해주세요.'
                });
            }
            await ref.update({ failCount });
            return res.status(401).json(generic);
        }

        await ref.update({ failCount: 0, lockedUntil: 0 });

        const customToken = await admin.auth().createCustomToken(uid, { provider: 'phone', phone });
        return res.status(200).json({ customToken, phone });
    } catch (error) {
        console.error('login-pin error:', error);
        return res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
    }
};
