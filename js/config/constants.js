// Data Storage Keys
const STORAGE_KEYS = {
    ADMIN_LOGGED_IN: 'matchingService_adminLoggedIn',
    CURRENT_USER: 'matchingService_currentUser'
};

// Admin Password Hash
const ADMIN_PASSWORD_HASH = 'b8b8eb83374c0bf3b1c3224159f6119dbfff1b7ed6dfecdd80d4e8a895790a34';

// Preference field definitions
const PREFERENCE_FIELDS = [
    { id: 'birthYear', label: '나이 (출생년도)', type: 'range' },
    { id: 'religion', label: '종교', type: 'multi' },
    { id: 'height', label: '키', type: 'range' },
    { id: 'bodyType', label: '체격', type: 'multi' },
    { id: 'drinking', label: '음주', type: 'select' },
    { id: 'hobbies', label: '취미', type: 'multi' },
    { id: 'job', label: '직업/직군', type: 'select' },
    { id: 'location', label: '거주 지역', type: 'select' },
    { id: 'smoking', label: '흡연 여부', type: 'select' },
    { id: 'mbti', label: 'MBTI', type: 'text' },
    { id: 'marriagePlan', label: '결혼 계획', type: 'select' },
    { id: 'education', label: '학력', type: 'select' }
];

// Export to global scope
window.STORAGE_KEYS = STORAGE_KEYS;
window.ADMIN_PASSWORD_HASH = ADMIN_PASSWORD_HASH;
window.PREFERENCE_FIELDS = PREFERENCE_FIELDS;
