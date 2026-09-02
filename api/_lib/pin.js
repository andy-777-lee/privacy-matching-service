// 4-digit PIN hashing helpers.
//
// A 4-digit PIN only has 10,000 combinations, so the stored value must never be
// guessable offline and the login endpoint must rate limit. scrypt is used with
// a per-user random salt; comparison is timing-safe.
const crypto = require('crypto');

const PIN_RE = /^[0-9]{4}$/;

// Reject the PINs an attacker would try first.
function isWeakPin(pin) {
    if (/^(\d)\1{3}$/.test(pin)) return true; // 0000, 1111, ...
    const digits = pin.split('').map(Number);
    const ascending = digits.every((n, i) => i === 0 || n === digits[i - 1] + 1);
    const descending = digits.every((n, i) => i === 0 || n === digits[i - 1] - 1);
    return ascending || descending; // 1234, 4321, ...
}

function hashPin(pin, salt) {
    return crypto.scryptSync(pin, salt, 32).toString('hex');
}

// Build a fresh { salt, hash } pair for storage.
function makePinRecord(pin) {
    const salt = crypto.randomBytes(16).toString('hex');
    return { salt, hash: hashPin(pin, salt) };
}

function verifyPin(pin, record) {
    if (!record || !record.salt || !record.hash) return false;
    const candidate = Buffer.from(hashPin(pin, record.salt), 'hex');
    const stored = Buffer.from(record.hash, 'hex');
    if (candidate.length !== stored.length) return false;
    return crypto.timingSafeEqual(candidate, stored);
}

module.exports = { PIN_RE, isWeakPin, makePinRecord, verifyPin };
