// POST /api/notify  { idToken, type, requestId }
// Sends an SMS notification tied to an unlock request. Recipient phone numbers
// are looked up server-side and never exposed to the client.
const { admin, db } = require('./_lib/firebaseAdmin');
const { sendSms } = require('./_lib/sms');

const SITE_URL = process.env.SITE_URL || 'https://privacy-matching-service.vercel.app';

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { idToken, type, requestId } = req.body || {};
        if (!idToken || !type || !requestId) {
            return res.status(400).json({ error: '잘못된 요청입니다.' });
        }

        // Authenticate caller
        const decoded = await admin.auth().verifyIdToken(idToken);
        const callerUid = decoded.uid;

        // Load the unlock request
        const reqSnap = await db.collection('unlock_requests').doc(requestId).get();
        if (!reqSnap.exists) {
            return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
        }
        const unlockReq = reqSnap.data();

        let recipientId;
        let message;

        if (type === 'new_request') {
            // Requester -> Target: someone wants to see their profile
            if (unlockReq.requesterId !== callerUid) {
                return res.status(403).json({ error: '권한이 없습니다.' });
            }
            recipientId = unlockReq.targetId;
            message = `[지인 소개팅풀] 회원님의 프로필 공개 요청이 도착했습니다! 확인하기: ${SITE_URL}`;
        } else if (type === 'target_approved') {
            // Target -> Requester: target approved, requester's final OK needed
            if (unlockReq.targetId !== callerUid) {
                return res.status(403).json({ error: '권한이 없습니다.' });
            }
            recipientId = unlockReq.requesterId;
            message = `[지인 소개팅풀] 상대방이 요청을 수락했어요! 최종 확인해주세요: ${SITE_URL}`;
        } else if (type === 'rejected') {
            // Target -> Requester: rejected
            if (unlockReq.targetId !== callerUid) {
                return res.status(403).json({ error: '권한이 없습니다.' });
            }
            recipientId = unlockReq.requesterId;
            message = `[지인 소개팅풀] 아쉽게도 이번 프로필 공개 요청이 거절되었습니다.`;
        } else if (type === 'mutual_complete') {
            // Requester -> Target: mutual match completed
            if (unlockReq.requesterId !== callerUid) {
                return res.status(403).json({ error: '권한이 없습니다.' });
            }
            recipientId = unlockReq.targetId;
            message = `[지인 소개팅풀] 매칭이 성사되었습니다! 프로필을 확인해보세요: ${SITE_URL}`;
        } else {
            return res.status(400).json({ error: '알 수 없는 알림 유형입니다.' });
        }

        // Look up recipient's phone from the private collection (server-side only)
        const privSnap = await db.collection('user_private').doc(recipientId).get();
        const phone = privSnap.exists ? privSnap.data().phone : null;
        if (!phone) {
            // Recipient has no phone on file — nothing to send, but not an error
            return res.status(200).json({ success: true, sent: false });
        }

        await sendSms(phone, message);
        return res.status(200).json({ success: true, sent: true });
    } catch (error) {
        console.error('notify error:', error);
        return res.status(500).json({ error: '알림 발송 중 오류가 발생했습니다.' });
    }
};
