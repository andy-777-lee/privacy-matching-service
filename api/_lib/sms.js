// Shared SMS sender using Solapi (솔라피).
// Requires env vars:
//   SOLAPI_API_KEY    - Solapi API key
//   SOLAPI_API_SECRET - Solapi API secret
//   SOLAPI_SENDER     - registered sender phone number (등록된 발신번호), digits only e.g. "01012345678"
const { SolapiMessageService } = require('solapi');

let service = null;
function getService() {
    if (!service) {
        service = new SolapiMessageService(
            process.env.SOLAPI_API_KEY,
            process.env.SOLAPI_API_SECRET
        );
    }
    return service;
}

// Normalize a Korean phone number to digits only (strip hyphens/spaces).
function normalizePhone(phone) {
    return String(phone).replace(/[^0-9]/g, '');
}

// Send a single SMS. Returns the Solapi response.
// solapi v6 exposes a single `send()` that accepts one message or an array.
async function sendSms(to, text) {
    return getService().send({
        to: normalizePhone(to),
        from: normalizePhone(process.env.SOLAPI_SENDER),
        text
    });
}

module.exports = { sendSms, normalizePhone };
