// POST /api/send-otp  { phone }
// Generates a 6-digit OTP, stores it in Firestore, and sends it via SMS.
const crypto = require('crypto');
const { db } = require('./_lib/firebaseAdmin');
const { sendSms, normalizePhone } = require('./_lib/sms');

const OTP_TTL_MS = 5 * 60 * 1000;       // code valid for 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;   // min 60s between sends to the same number

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const phone = normalizePhone((req.body && req.body.phone) || '');

        // Validate Korean mobile number format (010xxxxxxxx)
        if (!/^01[0-9]{8,9}$/.test(phone)) {
            return res.status(400).json({ error: '올바른 휴대폰 번호를 입력해주세요.' });
        }

        const otpRef = db.collection('otp_codes').doc(phone);
        const existing = await otpRef.get();

        // Rate limit: block rapid re-sends
        if (existing.exists) {
            const lastSent = existing.data().createdAt || 0;
            if (Date.now() - lastSent < RESEND_COOLDOWN_MS) {
                const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSent)) / 1000);
                return res.status(429).json({ error: `${wait}초 후에 다시 시도해주세요.` });
            }
        }

        // Generate a cryptographically random 6-digit code
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const now = Date.now();

        await otpRef.set({
            code,
            expiresAt: now + OTP_TTL_MS,
            attempts: 0,
            createdAt: now
        });

        await sendSms(phone, `[지인 소개팅풀] 인증번호 [${code}] 를 입력해주세요.`);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('send-otp error:', error);
        return res.status(500).json({ error: '인증번호 발송 중 오류가 발생했습니다.' });
    }
};
