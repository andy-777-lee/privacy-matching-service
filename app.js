// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCtCaLngksFACS5bVYFIm7wCuHz79B2oRA",
    authDomain: "privacy-matching-andylee.firebaseapp.com",
    projectId: "privacy-matching-andylee",
    storageBucket: "privacy-matching-andylee.firebasestorage.app",
    messagingSenderId: "868406980562",
    appId: "1:868406980562:web:c87fcd946ed7a06df8a20b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();


// Data Storage Keys (Legacy - keeping for admin login)
const STORAGE_KEYS = {
    ADMIN_LOGGED_IN: 'matchingService_adminLoggedIn',
    CURRENT_USER: 'matchingService_currentUser' // Added back for local usage if needed
};

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

let draggedElement = null;
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupHashNavigation();
});

async function initializeApp() {
    // Listen for Auth State Changes globally
    auth.onAuthStateChanged(async (user) => {
        const adminLoggedIn = localStorage.getItem(STORAGE_KEYS.ADMIN_LOGGED_IN);

        if (user) {
            console.log("User is signed in:", user.uid);

            // If admin is logged in locally, stay on admin dashboard
            if (adminLoggedIn) {
                if (window.location.hash === '#admin') {
                    showAdminDashboard();
                } else {
                    // If logged in but hash is not #admin, maybe redirect or just show dashboard
                    // But if they are on main page, they might want to see main page?
                    // For simplicity, if admin flag is set, assume admin mode
                    showAdminDashboard();
                }
                return;
            }

            // Regular user logic
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    currentUser = userDoc.data();
                    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUser.id);

                    // Always setup registration form first to register event listeners
                    setupRegistrationForm();

                    if (!currentUser.preferences) {
                        showPage('preference-page');
                        // Trigger setup after registration form is ready
                        setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('setupPreferences'));
                        }, 100);
                    } else {
                        showPage('matches-page');
                        setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('showMatches'));
                        }, 100);
                    }
                } else {
                    console.warn("Firestore document not found for user", user.uid);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                // Only alert if not admin (admin might not have user doc)
                if (!adminLoggedIn) {
                    alert('사용자 정보를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.');
                    auth.signOut();
                }
            }
        } else {
            console.log("User is signed out");
            currentUser = null;
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

            // If admin flag was set but auth is gone, clear flag
            if (adminLoggedIn) {
                // Wait a bit to see if it's just initialization delay? 
                // No, onAuthStateChanged with null means definitely signed out.
                localStorage.removeItem(STORAGE_KEYS.ADMIN_LOGGED_IN);
            }

            // Check if trying to access admin page
            if (window.location.hash === '#admin') {
                showAdminLogin();
            } else {
                showPage('login-page');
                setupLoginPage();
            }
        }
    });
}

const hash = window.location.hash;

// Duplicate auth listener removed – initialization handled in initializeApp()

function setupHashNavigation() {
    window.addEventListener('hashchange', () => {
        initializeApp();
    });
}

// Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Password Hashing
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Login Page Setup
function setupLoginPage() {
    const loginForm = document.getElementById('login-form');
    const goToRegisterBtn = document.getElementById('go-to-register');
    const loginError = document.getElementById('login-error');

    // Setup password input auto-focus
    const passwordDigits = document.querySelectorAll('.password-digit');
    const passwordHidden = document.getElementById('login-password');

    passwordDigits.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                // Move to next input
                if (index < passwordDigits.length - 1) {
                    passwordDigits[index + 1].focus();
                }
            }
            // Combine all digits into hidden field
            passwordHidden.value = Array.from(passwordDigits).map(d => d.value).join('');
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '') {
                // Move to previous input on backspace
                if (index > 0) {
                    passwordDigits[index - 1].focus();
                }
            }
        });
    });

    // Handle login
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';

        const kakaoId = document.getElementById('login-kakao-id').value.trim();
        const password = passwordHidden.value;

        try {
            // Use Kakao ID to create a synthetic email for Firebase Auth
            const email = `${kakaoId}@matching.app`;

            // Pad password to 6 characters to match registration format
            const paddedPassword = password.padEnd(6, '0');

            // Sign in with Firebase Auth
            await auth.signInWithEmailAndPassword(email, paddedPassword);

            // Note: Navigation will be handled by onAuthStateChanged in initializeApp
        } catch (error) {
            console.error('Login error:', error);
            let msg = '로그인 중 오류가 발생했습니다.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msg = '아이디 또는 비밀번호가 올바르지 않습니다.';
            } else if (error.code === 'auth/invalid-email') {
                msg = '유효하지 않은 아이디 형식입니다.';
            }
            loginError.textContent = msg;
            loginError.style.display = 'block';

            // Clear password fields on login failure
            passwordDigits.forEach(input => {
                input.value = '';
            });
            passwordHidden.value = '';
            // Focus on first password digit
            if (passwordDigits.length > 0) {
                passwordDigits[0].focus();
            }
        }
    };

    // Handle go to register
    goToRegisterBtn.onclick = () => {
        showPage('registration-page');
        setupRegistrationForm();
    };
}

// Notification Setup
function setupNotifications() {
    try {
        const notificationBtn = document.getElementById('notification-btn');
        const notificationModal = document.getElementById('notification-modal');
        const closeBtn = document.getElementById('close-notification-modal');

        // Guard: if elements are not present (e.g., login/registration pages), skip setup
        if (!notificationBtn || !notificationModal || !closeBtn) {
            console.log('Notification elements not found, skipping setup');
            return;
        }

        // Toggle modal
        notificationBtn.onclick = async () => {
            if (notificationModal.style.display === 'block') {
                notificationModal.style.display = 'none';
            } else {
                const notifications = await fetchNotifications(currentUser.id);
                displayNotifications(notifications);
                notificationModal.style.display = 'block';
            }
        };

        // Close modal
        closeBtn.onclick = () => {
            notificationModal.style.display = 'none';
        };

        window.onclick = (event) => {
            if (event.target === notificationModal) {
                notificationModal.style.display = 'none';
            }
        };

        // Poll for new notifications
        setInterval(async () => {
            if (currentUser) {
                const notifications = await fetchNotifications(currentUser.id);
                const unreadCount = notifications.filter(n => !n.read).length;

                const badge = document.getElementById('notification-badge');
                if (badge) {
                    if (unreadCount > 0) {
                        badge.textContent = unreadCount;
                        badge.style.display = 'flex';

                        // Show toast for latest unread notification if it's new (simple check)
                        const latest = notifications[0];
                        if (!latest.read && Date.now() - latest.createdAt < 10000) { // Created within last 10 seconds
                            // Prevent duplicate toasts (basic implementation)
                            if (!window.lastToastId || window.lastToastId !== latest.id) {
                                showToast(`🔔 ${latest.message}`, () => {
                                    notificationBtn.click();
                                });
                                window.lastToastId = latest.id;
                            }
                        }
                    } else {
                        badge.style.display = 'none';
                    }
                }

                // Update modal list if it's open
                if (notificationModal && notificationModal.style.display === 'block') {
                    displayNotifications(notifications);
                }
            }
        }, 5000); // Check every 5 seconds
    } catch (error) {
        console.error('Error setting up notifications:', error);
        // Don't throw - allow app to continue without notifications
    }
}

// Registration Form
function setupRegistrationForm() {
    setupPhotoUpload();
    updateUserCount(); // Update user count on page load

    // Setup registration password input auto-focus
    const passwordDigits = document.querySelectorAll('.password-digit-register');
    const passwordHidden = document.getElementById('password');

    passwordDigits.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                // Move to next input
                if (index < passwordDigits.length - 1) {
                    passwordDigits[index + 1].focus();
                }
            }
            // Combine all digits into hidden field
            passwordHidden.value = Array.from(passwordDigits).map(d => d.value).join('');
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value === '') {
                // Move to previous input on backspace
                if (index > 0) {
                    passwordDigits[index - 1].focus();
                }
            }
        });
    });

    // Location dropdown handler
    const locationSelect = document.getElementById('location');
    const customLocationGroup = document.getElementById('custom-location-group');
    const customLocationInput = document.getElementById('custom-location');

    locationSelect.addEventListener('change', () => {
        if (locationSelect.value === '기타') {
            customLocationGroup.style.display = 'block';
            customLocationInput.required = true;
        } else {
            customLocationGroup.style.display = 'none';
            customLocationInput.required = false;
            customLocationInput.value = '';
        }
    });

    const form = document.getElementById('registration-form');
    // Single async submit handler for registration form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate photos (ensure three photos are uploaded)
        const photos = [];
        for (let i = 0; i < 3; i++) {
            const preview = document.querySelector(`[data-index="${i}"] .photo-preview`);
            if (!preview.classList.contains('active')) {
                alert('사진 3장을 모두 등록해주세요.');
                return;
            }
            photos.push(preview.querySelector('img').src);
        }

        // Get selected hobbies
        const hobbies = Array.from(document.querySelectorAll('input[name="hobbies"]:checked')).map(cb => cb.value);
        if (hobbies.length === 0) {
            alert('취미를 최소 1개 이상 선택해주세요.');
            return;
        }

        // Validate MBTI (must be 4 characters)
        const mbti = document.getElementById('mbti').value.toUpperCase();
        if (mbti.length !== 4) {
            alert('MBTI는 4자리로 입력해주세요 (예: INFP)');
            return;
        }

        // Validate password length before hashing
        const rawPassword = document.getElementById('password').value;
        console.log('Registration raw password:', rawPassword);
        if (!rawPassword || rawPassword.length !== 4) {
            alert('비밀번호 4자리를 모두 입력해주세요.');
            return;
        }
        // const hashedPwd = await hashPassword(rawPassword); // No longer hashing password for Firestore
        // console.log('Hashed password to store:', hashedPwd);

        const formData = {
            name: document.getElementById('name').value,
            gender: document.querySelector('input[name="gender"]:checked').value,
            birthYear: parseInt(document.getElementById('birth-year').value),
            religion: document.getElementById('religion').value,
            height: parseInt(document.getElementById('height').value),
            bodyType: document.getElementById('body-type').value,
            drinking: document.getElementById('drinking').value,
            hobbies: hobbies,
            job: document.getElementById('job').value,
            workplace: document.getElementById('workplace').value,
            highSchool: document.getElementById('high-school').value,
            location: document.getElementById('location').value === '기타'
                ? document.getElementById('custom-location').value
                : document.getElementById('location').value,
            smoking: document.querySelector('input[name="smoking"]:checked').value,
            mbti: mbti,
            marriagePlan: document.getElementById('marriage-plan').value,
            contactKakao: document.getElementById('kakao-id').value,
            contactInstagram: document.getElementById('instagram-id').value,
            password: rawPassword, // Use raw password for Firebase Auth
            photos: photos,
        };

        const currentYear = new Date().getFullYear();
        formData.age = currentYear - formData.birthYear + 1; // Korean age calculation

        try {
            // 1. Create Authentication User
            const email = `${formData.contactKakao}@matching.app`;

            // Firebase Auth requires minimum 6 characters for password
            // Pad the 4-digit password to meet this requirement
            const paddedPassword = formData.password.padEnd(6, '0');

            const userCredential = await auth.createUserWithEmailAndPassword(email, paddedPassword);
            const authUser = userCredential.user;

            // 2. Create Firestore User Document
            // createUserWithEmailAndPassword automatically signs in the user,
            // so we can now write to Firestore with proper authentication
            const user = {
                id: authUser.uid, // IMPORTANT: Link Auth ID to Firestore ID
                ...formData,
                password: null, // Don't store password in Firestore! Auth handles it.
                createdAt: Date.now()
            };

            // Wait a moment to ensure auth state is fully propagated
            await new Promise(resolve => setTimeout(resolve, 100));

            await saveUser(user);

            // Send Discord Notification
            try {
                await sendNewUserDiscordNotification(user);
            } catch (discordError) {
                console.error('Failed to send Discord notification:', discordError);
            }

            alert('회원가입이 완료되었습니다!');
            // Navigation will be handled by onAuthStateChanged
        } catch (error) {
            console.error('Registration error:', error);
            let msg = '회원가입 중 오류가 발생했습니다.';
            if (error.code === 'auth/email-already-in-use') {
                msg = '이미 등록된 카카오 ID입니다.';
            } else if (error.code === 'auth/weak-password') {
                msg = '비밀번호는 6자 이상이어야 합니다.'; // Firebase Auth requires 6+ chars
            } else if (error.code === 'permission-denied') {
                msg = '권한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
            }
            alert(msg);
        }
    });

    function setupPhotoUpload() {
        document.querySelectorAll('.photo-input').forEach((input, index) => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                        alert('사진 크기는 5MB 이하여야 합니다.');
                        return;
                    }

                    // Compress image before storing
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            // Create canvas for compression
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');

                            // Calculate new dimensions (max 800px on longest side)
                            let width = img.width;
                            let height = img.height;
                            const maxSize = 800;

                            if (width > height && width > maxSize) {
                                height = (height * maxSize) / width;
                                width = maxSize;
                            } else if (height > maxSize) {
                                width = (width * maxSize) / height;
                                height = maxSize;
                            }

                            canvas.width = width;
                            canvas.height = height;

                            // Draw and compress
                            ctx.drawImage(img, 0, 0, width, height);
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality

                            // Display preview
                            const preview = document.querySelector(`[data-index="${index}"] .photo-preview`);
                            preview.innerHTML = `<img src="${compressedDataUrl}" alt="Photo ${index + 1}">`;
                            preview.classList.add('active');
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        });
    }

    // Preference Selection Page
    function showPreferencePage() {
        showPage('preference-page');
        setupPreferenceSelection();
    }

    // Listen for edit preferences event
    window.addEventListener('editPreferences', () => {
        showPreferencePage();
        // Call setupPreferenceSelection to restore existing preferences
        setTimeout(() => {
            setupPreferenceSelection();
        }, 100);
    });

    // Listen for setup preferences event (triggered after login)
    window.addEventListener('setupPreferences', () => {
        setupPreferenceSelection();
    });

    // Setup close button for preference page
    const closePreferenceBtn = document.getElementById('close-preference-page');
    if (closePreferenceBtn) {
        closePreferenceBtn.addEventListener('click', () => {
            // Go back to matches page if user has preferences, otherwise stay
            if (currentUser && currentUser.preferences) {
                showPage('matches-page');
                window.dispatchEvent(new CustomEvent('showMatches'));
            }
        });

        // Add hover effect
        closePreferenceBtn.addEventListener('mouseenter', () => {
            closePreferenceBtn.style.color = 'var(--primary)';
        });
        closePreferenceBtn.addEventListener('mouseleave', () => {
            closePreferenceBtn.style.color = 'var(--text-secondary)';
        });
    }


    let preferenceSelectionInitialized = false;

    function setupPreferenceSelection() {
        const selectGrid = document.getElementById('preference-select');
        const priorityCard = document.getElementById('priority-card');
        const priorityList = document.getElementById('priority-list');

        console.log('setupPreferenceSelection called');
        console.log('selectGrid:', selectGrid);
        console.log('PREFERENCE_FIELDS:', PREFERENCE_FIELDS);

        if (!selectGrid) {
            console.error('preference-select element not found!');
            return;
        }

        // Only generate HTML once
        if (!preferenceSelectionInitialized) {
            // Populate preference options
            selectGrid.innerHTML = PREFERENCE_FIELDS.map(field => `
            <div class="preference-option">
                <input type="checkbox" id="pref-${field.id}" value="${field.id}">
                <label for="pref-${field.id}">${field.label}</label>
            </div>
        `).join('');

            console.log('Checkboxes created, innerHTML length:', selectGrid.innerHTML.length);

            // Listen for checkbox changes (only once)
            selectGrid.addEventListener('change', () => {
                const selected = Array.from(selectGrid.querySelectorAll('input:checked'))
                    .map(cb => cb.value);

                if (selected.length > 0) {
                    // Save current values before regenerating
                    const currentValues = saveCurrentPreferenceValues();

                    showPreferenceValues(selected);
                    priorityCard.style.display = 'block';
                    updatePriorityList(selected);

                    // Restore saved values
                    restorePreferenceValues(currentValues);
                } else {
                    document.getElementById('preference-values-card').style.display = 'none';
                    priorityCard.style.display = 'none';
                }
            });

            preferenceSelectionInitialized = true;
        }

        // Load existing preferences if user has them
        // When preferences are stored as a map, extract the field keys for UI restoration
        let selectedFields = [];
        if (currentUser && currentUser.preferences) {
            selectedFields = Object.keys(currentUser.preferences);
            console.log('Loading existing preferences:', selectedFields);
        }

        // Clear all checkboxes first
        selectGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Check the checkboxes for existing preferences (immediately, no setTimeout)
        selectedFields.forEach(fieldId => {
            const checkbox = document.getElementById(`pref-${fieldId}`);
            if (checkbox) {
                checkbox.checked = true;
                console.log(`✓ Checked preference: ${fieldId}`);
            } else {
                console.warn(`✗ Checkbox not found for: ${fieldId}`);
            }
        });

        // Show preference values and priority list
        if (selectedFields.length > 0) {
            setTimeout(() => {
                showPreferenceValues(selectedFields);
                priorityCard.style.display = 'block';
                updatePriorityList(selectedFields);

                // Restore the actual values
                setTimeout(() => {
                    // Iterate over the map entries to restore values
                    Object.entries(currentUser.preferences).forEach(([fieldId, pref]) => {
                        const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);
                        if (!field) return;

                        const inputContainer = document.getElementById(`input-${fieldId}`);
                        if (!inputContainer) return;

                        if (field.type === 'range') {
                            const minInput = inputContainer.querySelector('.min-input');
                            const maxInput = inputContainer.querySelector('.max-input');
                            if (minInput && maxInput && pref.value) {
                                minInput.value = pref.value.min;
                                maxInput.value = pref.value.max;
                            }
                        } else if (field.type === 'multi') {
                            if (Array.isArray(pref.value)) {
                                pref.value.forEach(val => {
                                    const checkbox = inputContainer.querySelector(`input[value="${val}"]`);
                                    if (checkbox) checkbox.checked = true;
                                });
                            }
                        } else if (field.type === 'text') {
                            const input = inputContainer.querySelector('input');
                            if (input && pref.value) {
                                input.value = pref.value;
                            }
                        } else if (field.type === 'select') {
                            const select = inputContainer.querySelector('select');
                            if (select && pref.value) {
                                select.value = pref.value;
                            }
                        }
                    });
                }, 100);
            }, 50);
        }
    }

    // Setup form submission
    // Submit Preferences
    document.getElementById('submit-preferences').addEventListener('click', async () => {
        const selectGrid = document.getElementById('preference-select');
        const selected = Array.from(selectGrid.querySelectorAll('input:checked'))
            .map(cb => cb.value);

        if (selected.length === 0) {
            alert('최소 1개 이상의 조건을 선택해주세요.');
            return;
        }

        // Collect detailed values
        const priorities = [];
        const listItems = document.querySelectorAll('#priority-list .priority-item');

        listItems.forEach((li, index) => {
            const fieldId = li.dataset.fieldId;
            const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);

            // Get value from input
            let value;
            const inputContainer = document.getElementById(`input-${fieldId}`);
            if (inputContainer) {
                if (field.type === 'range') {
                    const min = inputContainer.querySelector('.min-input').value;
                    const max = inputContainer.querySelector('.max-input').value;
                    value = { min: parseInt(min), max: parseInt(max) };
                } else if (field.type === 'multi') {
                    value = Array.from(inputContainer.querySelectorAll('input:checked')).map(cb => cb.value);
                } else if (field.type === 'text') {
                    value = inputContainer.querySelector('input').value;
                } else {
                    value = inputContainer.querySelector('select').value;
                }
            }

            priorities.push({
                field: fieldId,
                label: field.label,
                priority: index + 1,
                value: value
            });
        });

        console.log('Saving preferences:', priorities);

        // Update existing user instead of creating new one
        if (currentUser) {
            console.log('Updating currentUser preferences...');
            // Convert the array of priority objects into a map for efficient storage
            const prefMap = {};
            priorities.forEach(p => {
                prefMap[p.field] = {
                    label: p.label,
                    priority: p.priority,
                    value: p.value
                };
            });
            // Store preferences as a map (field -> {label, priority, value})
            currentUser.preferences = prefMap;
            // Also keep a timestamp for debugging
            currentUser.preferencesUpdatedAt = Date.now();

            console.log('Updated currentUser:', currentUser);

            // Save to Firestore
            await saveUser(currentUser);
            console.log('Saved to Firestore successfully');

            // Reload user data from Firestore to ensure consistency
            const userDoc = await db.collection('users').doc(currentUser.id).get();
            if (userDoc.exists) {
                currentUser = userDoc.data();
                console.log('Reloaded currentUser from Firestore:', currentUser);
            }

            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUser.id);

            // Show matches page using custom event
            showPage('matches-page');

            // Force display matches with updated user
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('showMatches'));
            }, 100);
        }
    });
}

function updatePriorityList(selectedFields) {
    const priorityList = document.getElementById('priority-list');
    const currentOrder = Array.from(priorityList.children).map(item => item.dataset.fieldId);

    // Keep existing order, add new ones at the end
    const newOrder = currentOrder.filter(id => selectedFields.includes(id));
    selectedFields.forEach(id => {
        if (!newOrder.includes(id)) {
            newOrder.push(id);
        }
    });

    priorityList.innerHTML = newOrder.map((fieldId, index) => {
        const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);

        // Skip if field is not found
        if (!field) {
            console.warn(`Field ${fieldId} not found in PREFERENCE_FIELDS (updatePriorityList)`);
            return '';
        }

        return `
            <div class="priority-item" draggable="true" data-field-id="${fieldId}">
                <span class="priority-number">${index + 1}</span>
                <span class="priority-label">${field.label}</span>
                <span class="drag-handle">☰</span>
            </div>
        `;
    }).join('');

    setupDragAndDrop();
}

// Touch event variables
let touchStartY = 0;
let touchCurrentY = 0;
let touchElement = null;

function setupDragAndDrop() {
    const items = document.querySelectorAll('.priority-item');

    items.forEach(item => {
        // Desktop drag events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);

        // Mobile touch events
        item.addEventListener('touchstart', handleTouchStart, { passive: false });
        item.addEventListener('touchmove', handleTouchMove, { passive: false });
        item.addEventListener('touchend', handleTouchEnd, { passive: false });
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.priority-item').forEach(item => {
        item.classList.remove('drag-over');
    });

    // Update priority numbers
    updatePriorityNumbers();
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedElement !== this) {
        const priorityList = document.getElementById('priority-list');
        const allItems = Array.from(priorityList.children);
        const draggedIndex = allItems.indexOf(draggedElement);
        const targetIndex = allItems.indexOf(this);

        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }
    }

    return false;
}

// Touch event handlers for mobile
function handleTouchStart(e) {
    touchElement = this;
    draggedElement = this;

    const touch = e.touches[0];
    touchStartY = touch.clientY;
    touchCurrentY = touch.clientY;

    this.classList.add('dragging');

    // Prevent default to avoid scrolling while dragging
    e.preventDefault();
}

function handleTouchMove(e) {
    if (!touchElement) return;

    e.preventDefault();

    const touch = e.touches[0];
    touchCurrentY = touch.clientY;

    // Move the element visually
    const deltaY = touchCurrentY - touchStartY;
    touchElement.style.transform = `translateY(${deltaY}px)`;
    touchElement.style.opacity = '0.8';
    touchElement.style.zIndex = '1000';

    // Find the element we're hovering over
    const priorityList = document.getElementById('priority-list');
    const allItems = Array.from(priorityList.children);

    // Remove all drag-over classes
    allItems.forEach(item => {
        if (item !== touchElement) {
            item.classList.remove('drag-over');
        }
    });

    // Find which item we're over
    allItems.forEach(item => {
        if (item === touchElement) return;

        const rect = item.getBoundingClientRect();
        const itemMiddle = rect.top + rect.height / 2;

        if (touchCurrentY > rect.top && touchCurrentY < rect.bottom) {
            item.classList.add('drag-over');
        }
    });
}

function handleTouchEnd(e) {
    if (!touchElement) return;

    e.preventDefault();

    // Reset visual state
    touchElement.style.transform = '';
    touchElement.style.opacity = '';
    touchElement.style.zIndex = '';
    touchElement.classList.remove('dragging');

    const priorityList = document.getElementById('priority-list');
    const allItems = Array.from(priorityList.children);

    // Find the target item
    let targetItem = null;
    allItems.forEach(item => {
        if (item.classList.contains('drag-over')) {
            targetItem = item;
        }
        item.classList.remove('drag-over');
    });

    // Reorder if we have a target
    if (targetItem && targetItem !== touchElement) {
        const draggedIndex = allItems.indexOf(touchElement);
        const targetIndex = allItems.indexOf(targetItem);

        if (draggedIndex < targetIndex) {
            targetItem.parentNode.insertBefore(touchElement, targetItem.nextSibling);
        } else {
            targetItem.parentNode.insertBefore(touchElement, targetItem);
        }

        // Update priority numbers
        updatePriorityNumbers();
    }

    touchElement = null;
    draggedElement = null;
    touchStartY = 0;
    touchCurrentY = 0;
}



// Show preference value inputs
function showPreferenceValues(selectedFields) {
    const card = document.getElementById('preference-values-card');
    const container = document.getElementById('preference-values-container');

    if (selectedFields.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';

    container.innerHTML = selectedFields.map(fieldId => {
        const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);

        // Skip if field is not found in PREFERENCE_FIELDS
        if (!field) {
            console.warn(`Field ${fieldId} not found in PREFERENCE_FIELDS`);
            return '';
        }

        if (field.type === 'range') {
            if (fieldId === 'birthYear') {
                return `
                    <div class="form-group" id="input-${fieldId}">
                        <label>${field.label}</label>
                        <div class="range-input-group">
                            <input type="number" class="min-input" id="pref-value-${fieldId}-min" min="1920" max="2007" placeholder="최소" required>
                            <span>~</span>
                            <input type="number" class="max-input" id="pref-value-${fieldId}-max" min="1920" max="2007" placeholder="최대" required>
                        </div>
                    </div>
                `;
            } else if (fieldId === 'height') {
                return `
                    <div class="form-group" id="input-${fieldId}">
                        <label>${field.label} (cm)</label>
                        <div class="range-input-group">
                            <input type="number" class="min-input" id="pref-value-${fieldId}-min" min="140" max="220" placeholder="최소" required>
                            <span>~</span>
                            <input type="number" class="max-input" id="pref-value-${fieldId}-max" min="140" max="220" placeholder="최대" required>
                        </div>
                    </div>
                `;
            }
        } else if (field.type === 'select') {
            let options = [];
            if (fieldId === 'drinking') {
                options = ['안 마심', '가끔', '자주'];
            } else if (fieldId === 'job') {
                options = ['학생', '직장인', '자영업', '프리랜서', '기타'];
            } else if (fieldId === 'education') {
                options = ['고졸', '전문대졸', '대졸', '대학원'];
            } else if (fieldId === 'location') {
                options = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '김해', '창원', '포항'];
            } else if (fieldId === 'smoking') {
                options = ['비흡연', '흡연'];
            } else if (fieldId === 'marriagePlan') {
                options = ['1년 내', '2-3년 내', '5년 이내', '천천히', '미정']; // Added '5년 이내'
            }

            return `
                    <div class="form-group" id="input-${fieldId}">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
        } else if (field.type === 'multi') {
            let options = [];
            if (fieldId === 'hobbies') {
                options = ['운동', '영화', '음악', '독서', '여행', '요리', '게임', '기타'];
            } else if (fieldId === 'religion') {
                options = ['무교', '기독교', '천주교', '불교', '기타'];
            } else if (fieldId === 'bodyType') {
                options = ['마름', '보통', '통통', '건장', '근육'];
            }

            return `
                <div class="form-group" id="input-${fieldId}">
                    <label>${field.label}</label>
                    <div class="hobby-grid">
                        ${options.map(opt => `
                            <label class="hobby-option">
                                <input type="checkbox" name="pref-value-${fieldId}" value="${opt}">
                                <span>${opt}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                `;
        } else if (field.type === 'text' && fieldId === 'mbti') {
            return `
                <div class="form-group" id="input-${fieldId}">
                    <label>${field.label} <small>(쉼표로 구분하여 여러 개 입력 가능)</small></label>
                    <input type="text" id="pref-value-${fieldId}" placeholder="예: INFP,ENTP,ISTP" required>
                </div>
            `;
        }
        return '';
    }).join('');
}

// Save current preference values before regenerating form
function saveCurrentPreferenceValues() {
    const values = {};

    PREFERENCE_FIELDS.forEach(field => {
        if (field.type === 'range') {
            const minInput = document.getElementById(`pref-value-${field.id}-min`);
            const maxInput = document.getElementById(`pref-value-${field.id}-max`);
            if (minInput && maxInput && minInput.value && maxInput.value) {
                values[field.id] = {
                    min: minInput.value,
                    max: maxInput.value
                };
            }
        } else if (field.type === 'select') {
            const select = document.getElementById(`pref-value-${field.id}`);
            if (select && select.value) {
                values[field.id] = select.value;
            }
        } else if (field.type === 'multi') {
            const checked = Array.from(document.querySelectorAll(`input[name="pref-value-${field.id}"]:checked`))
                .map(cb => cb.value);
            if (checked.length > 0) {
                values[field.id] = checked;
            }
        } else if (field.type === 'text') {
            const input = document.getElementById(`pref-value-${field.id}`);
            if (input && input.value) {
                values[field.id] = input.value;
            }
        }
    });

    return values;
}

// Restore preference values after regenerating form
function restorePreferenceValues(savedValues) {
    if (!savedValues) return;

    Object.keys(savedValues).forEach(fieldId => {
        const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);
        if (!field) return;

        const value = savedValues[fieldId];

        if (field.type === 'range') {
            const minInput = document.getElementById(`pref-value-${fieldId}-min`);
            const maxInput = document.getElementById(`pref-value-${fieldId}-max`);
            if (minInput && maxInput && value.min && value.max) {
                minInput.value = value.min;
                maxInput.value = value.max;
            }
        } else if (field.type === 'select') {
            const select = document.getElementById(`pref-value-${fieldId}`);
            if (select && value) {
                select.value = value;
            }
        } else if (field.type === 'multi') {
            if (Array.isArray(value)) {
                value.forEach(val => {
                    const checkbox = document.querySelector(`input[name="pref-value-${fieldId}"][value="${val}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            } else if (typeof value === 'string') {
                // Handle legacy single string values (e.g. religion was previously a string)
                const checkbox = document.querySelector(`input[name="pref-value-${fieldId}"][value="${value}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            }
        } else if (field.type === 'text') {
            const input = document.getElementById(`pref-value-${fieldId}`);
            if (input && value) {
                input.value = value;
            }
        }
    });
}

function updatePriorityNumbers() {
    const items = document.querySelectorAll('.priority-item');
    items.forEach((item, index) => {
        item.querySelector('.priority-number').textContent = index + 1;
    });
}

// Matches Page
function showMatchesPage() {
    showPage('matches-page');
    displayMatches();

    // My profile button
    document.getElementById('my-profile-btn').addEventListener('click', () => {
        showProfileModal(currentUser, false, null, true); // true = isOwnProfile
    });

    // Setup notifications after page is shown
    setupNotifications();
}

// Listen for custom event to trigger displayMatches from outside
window.addEventListener('showMatches', () => {
    displayMatches();

    // Setup my profile button
    const myProfileBtn = document.getElementById('my-profile-btn');
    if (myProfileBtn && !myProfileBtn.onclick) {
        myProfileBtn.addEventListener('click', () => {
            showProfileModal(currentUser, false, null, true); // true = isOwnProfile
        });
    }

    // Setup notifications after page is shown
    setupNotifications();
});

// Listen for unlocked profile event from notifications
window.addEventListener('showUnlockedProfile', (event) => {
    const { user } = event.detail;
    showProfileModal(user, false, null, false, true); // forceUnlocked = true for approved profiles
});


async function displayMatches() {
    console.log('--- displayMatches called ---');
    console.log('Current User for matching:', currentUser);
    if (!currentUser || !currentUser.preferences) {
        console.warn('Current user has no preferences in displayMatches!');
    }
    const matches = await findMatches(currentUser);
    const grid = document.getElementById('matches-grid');
    const noMatches = document.getElementById('no-matches');

    if (matches.length === 0) {
        grid.style.display = 'none';
        noMatches.style.display = 'block';

        // Show mismatch analysis
        const analysis = await analyzeMismatches(currentUser);
        const mismatchList = analysis.mismatchDetails
            .sort((a, b) => b.count - a.count)
            .map(item => `
                <div class="mismatch-item">
                    <span class="mismatch-label">${item.label}</span>
                    <span class="mismatch-count">${item.count}명 미매칭</span>
                </div>
            `).join('');

        noMatches.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">💔</span>
                <h3>매칭되는 프로필이 없습니다</h3>
                <p>총 ${analysis.totalCandidates}명의 프로필이 있지만 조건이 맞지 않습니다</p>

                <div class="mismatch-analysis">
                    <h4>조건별 미매칭 분석</h4>
                    ${mismatchList}
                </div>

                <p class="hint">선호 조건을 수정하거나 범위를 넓혀보세요</p>
                <button onclick="window.dispatchEvent(new CustomEvent('editPreferences'))" class="btn-primary" style="
                    margin-top: 1.5rem;
                    padding: 1rem 2rem;
                    font-size: 1.1rem;
                    font-weight: 600;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    transition: all 0.3s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)';">
                    <span style="font-size: 1.2rem;">⚙️</span>
                    선호 조건 수정하기
                </button>
            </div>
        `;
        return;
    }
    grid.style.display = 'grid';
    noMatches.style.display = 'none';

    const unlockedProfiles = await fetchUnlockedProfiles(currentUser.id);

    grid.innerHTML = matches.map(match => {
        const isUnlocked = unlockedProfiles.includes(match.user.id);
        return createMatchCard(match, isUnlocked);
    }).join('');

    // Add click handlers
    grid.querySelectorAll('.match-card').forEach(card => {
        card.addEventListener('click', () => {
            const userId = card.dataset.userId;
            const match = matches.find(m => m.user.id === userId);
            const isUnlocked = unlockedProfiles.includes(userId);
            showProfileModal(match.user, !isUnlocked, match.score);
        });
    });
}

function createMatchCard(match, isUnlocked) {
    const user = match.user;
    const score = match.score;

    return `
        <div class="match-card ${isUnlocked ? 'unlocked' : ''}" data-user-id="${user.id}">
            <div class="match-photos">
                <span class="match-percentage">${score}% 매칭</span>
                ${isUnlocked ? '<span class="unlocked-badge">🔓 공개됨</span>' : ''}
                <img src="${user.photos && user.photos[0] ? user.photos[0] : ''}" class="${isUnlocked ? '' : 'blurred-photo'}" alt="Profile">
            </div>
            <div class="match-info">
                <div class="match-name ${isUnlocked ? '' : 'hidden-name'}">
                    ${isUnlocked ? (user.name || '이름 없음') : '***'}
                </div>
                <div class="match-details">
                    <span class="match-tag">${user.birthYear || '?'}년생 (${user.age || '?'}세)</span>
                    <span class="match-tag">${user.religion || '정보 없음'}</span>
                    <span class="match-tag">${user.height || '?'}cm</span>
                    <span class="match-tag">${user.job || '정보 없음'}</span>
                </div>
                <div class="match-details">
                    <span class="match-tag">${user.workplace || '정보 없음'}</span>
                    <span class="match-tag">${user.highSchool || '정보 없음'}</span>
                    <span class="match-tag">${user.location || '정보 없음'}</span>
                    <span class="match-tag">${user.smoking || '정보 없음'}</span>
                    <span class="match-tag">${user.mbti || '?'}</span>
                </div>
                <div class="match-hobbies">
                    ${user.hobbies && user.hobbies.length > 0 ? user.hobbies.slice(0, 3).map(h => `<span class="hobby-tag">${h}</span>`).join('') : '<span class="hobby-tag">취미 정보 없음</span>'}
                </div>
            </div>
        </div>
    `;
}

// Profile Modal
async function showProfileModal(user, showUnlockButton = false, matchScore = null, isOwnProfile = false, forceUnlocked = false) {
    const modal = document.getElementById('profile-modal');
    const detail = document.getElementById('profile-detail');

    const unlockedProfiles = await fetchUnlockedProfiles(currentUser.id);
    const isUnlocked = forceUnlocked || unlockedProfiles.includes(user.id) || isOwnProfile; // Own profile is always unlocked


    detail.innerHTML = `
        ${matchScore ? `<div class="match-percentage" style="position: static; margin-bottom: 1rem;">${matchScore}% 매칭</div>` : ''}
        <div class="profile-photos">
            ${user.photos.map(photo => `
                <div class="profile-photo">
                    <img src="${photo}" class="${isUnlocked ? '' : 'blurred-photo'}" alt="Profile photo">
                </div>
            `).join('')}
        </div>
        <h2 class="${isUnlocked ? '' : 'hidden-name'}">${isUnlocked ? user.name : '***'}</h2>
        <div class="profile-info-grid">
            <div class="info-item">
                <div class="info-label">출생년도</div>
                <div class="info-value">${user.birthYear}년생 (${user.age}세)</div>
            </div>
            <div class="info-item">
                <div class="info-label">성별</div>
                <div class="info-value">${user.gender === 'male' ? '남성' : '여성'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">종교</div>
                <div class="info-value">${user.religion}</div>
            </div>
            <div class="info-item">
                <div class="info-label">키</div>
                <div class="info-value">${user.height}cm</div>
            </div>
            <div class="info-item">
                <div class="info-label">음주</div>
                <div class="info-value">${user.drinking}</div>
            </div>
            <div class="info-item">
                <div class="info-label">직업</div>
                <div class="info-value">${user.job}</div>
            </div>
            <div class="info-item">
                <div class="info-label">직장명</div>
                <div class="info-value">${user.workplace}</div>
            </div>
            <div class="info-item">
                <div class="info-label">고등학교</div>
                <div class="info-value">${user.highSchool || '정보 없음'}</div>
            </div>
            <div class="info-item">
                <div class="info-label">거주지</div>
                <div class="info-value">${user.location}</div>
            </div>
            <div class="info-item">
                <div class="info-label">흡연</div>
                <div class="info-value">${user.smoking}</div>
            </div>
            <div class="info-item">
                <div class="info-label">MBTI</div>
                <div class="info-value">${user.mbti}</div>
            </div>
            <div class="info-item">
                <div class="info-label">결혼 계획</div>
                <div class="info-value">${user.marriagePlan}</div>
            </div>
        </div>
        <div class="match-hobbies">
            ${user.hobbies.map(hobby => `<span class="hobby-tag">${hobby}</span>`).join('')}
        </div>
        ${isUnlocked ? `
            <div class="contact-info">
                <h4>📞 연락처</h4>
                <div class="contact-item">
                    <strong>카카오톡:</strong>
                    <span>${user.contactKakao}</span>
                </div>
                <div class="contact-item">
                    <strong>인스타그램:</strong>
                    <span>${user.contactInstagram}</span>
                </div>
            </div>
        ` : ''}
        ${showUnlockButton && !isUnlocked ? `
            <button class="btn btn-primary btn-unlock" onclick="requestUnlock('${user.id}')">
                프로필 공개 요청
            </button>
        ` : ''}
        ${isOwnProfile ? `
            <button class="btn btn-secondary btn-large" onclick="document.getElementById('profile-modal').classList.remove('active'); window.dispatchEvent(new CustomEvent('editPreferences'))">
                선호 조건 수정하기
            </button>
            <button class="btn btn-primary btn-large" onclick="openEditProfileModal()" style="margin-top: 0.5rem;">
                프로필 수정하기
            </button>
        ` : ''}
    `;

    modal.classList.add('active');

    // Close button
    modal.querySelector('.modal-close').onclick = () => {
        modal.classList.remove('active');
    };

    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    };
}

// Edit Preferences
function editPreferences() {
    document.getElementById('profile-modal').classList.remove('active');
    showPreferencePage();

    // Pre-populate existing preferences
    const selectGrid = document.getElementById('preference-select');
    const selectedFields = currentUser.preferences.priorities.map(p => p.field);

    // Check the selected preferences
    selectedFields.forEach(fieldId => {
        const checkbox = document.getElementById(`pref-${fieldId}`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });

    // Trigger change event to show values and priority list
    if (selectedFields.length > 0) {
        showPreferenceValues(selectedFields);
        document.getElementById('priority-card').style.display = 'block';
        updatePriorityList(selectedFields);

        // Pre-fill preference values
        currentUser.preferences.priorities.forEach(pref => {
            const field = PREFERENCE_FIELDS.find(f => f.id === pref.field);
            if (!field || !pref.value) return;

            if (field.type === 'range') {
                const minInput = document.getElementById(`pref-value-${pref.field}-min`);
                const maxInput = document.getElementById(`pref-value-${pref.field}-max`);
                if (minInput && maxInput && pref.value.min && pref.value.max) {
                    minInput.value = pref.value.min;
                    maxInput.value = pref.value.max;
                }
            } else if (field.type === 'select') {
                const select = document.getElementById(`pref-value-${pref.field}`);
                if (select && pref.value) {
                    select.value = pref.value;
                }
            } else if (field.type === 'multi') {
                if (Array.isArray(pref.value)) {
                    pref.value.forEach(val => {
                        const checkbox = document.querySelector(`input[name="pref-value-${pref.field}"][value="${val}"]`);
                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    });
                }
            } else if (field.type === 'text') {
                const input = document.getElementById(`pref-value-${pref.field}`);
                if (input && pref.value) {
                    input.value = pref.value;
                }
            }
        });
    }
}

// Unlock Request
async function requestUnlock(targetId) {
    document.getElementById('profile-modal').classList.remove('active');
    document.getElementById('unlock-modal').classList.add('active');
    document.getElementById('unlock-target-id').value = targetId;

    const form = document.getElementById('unlock-request-form');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const message = document.getElementById('unlock-message').value.trim();
        if (!message) {
            alert('메시지를 입력해주세요.');
            return;
        }

        const request = {
            id: 'request_' + Date.now(),
            requesterId: currentUser.id,
            targetId: targetId,
            message: message,
            status: 'pending',
            createdAt: Date.now()
        };

        await saveUnlockRequest(request);

        // Send Discord Notification
        try {
            await sendDiscordNotification(request, currentUser, targetId);
        } catch (error) {
            console.error('Failed to send Discord notification:', error);
        }

        document.getElementById('unlock-modal').classList.remove('active');
        document.getElementById('unlock-message').value = '';

        alert('공개 요청이 전송되었습니다. 관리자 승인 후 프로필을 확인할 수 있습니다.');
    };

    // Close button
    const modal = document.getElementById('unlock-modal');
    modal.querySelector('.modal-close').onclick = () => {
        modal.classList.remove('active');
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    };
}

// Analyze why there are no matches
async function analyzeMismatches(user) {
    const allUsers = await fetchUsers();
    const candidates = allUsers.filter(u =>
        u.id !== user.id && u.gender !== user.gender
    );

    const mismatchCounts = {};

    // Initialize mismatch counts for each preference
    Object.keys(user.preferences).forEach(fieldId => {
        const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);
        if (field) {
            mismatchCounts[fieldId] = {
                label: field.label,
                count: 0
            };
        }
    });

    // Count mismatches for each candidate
    candidates.forEach(candidate => {
        Object.entries(user.preferences).forEach(([fieldId, pref]) => {
            if (!matchesPreference(candidate, fieldId, pref)) {
                mismatchCounts[fieldId].count++;
            }
        });
    });

    // Convert to array and sort by count (descending)
    const mismatchDetails = Object.keys(mismatchCounts)
        .map(field => mismatchCounts[field])
        .sort((a, b) => b.count - a.count);


    return {
        totalCandidates: candidates.length,
        mismatchDetails: mismatchDetails
    };
}

// Global function for editing preferences (called from HTML onclick)
function editPreferences() {
    document.getElementById('profile-modal').classList.remove('active');
    showPage('preference-page');

    // Call setupRegistrationForm to initialize all nested functions
    setupRegistrationForm();
}

// Global function for requesting profile unlock (called from HTML onclick)
async function requestUnlock(targetId) {
    document.getElementById('profile-modal').classList.remove('active');
    document.getElementById('unlock-modal').classList.add('active');
    document.getElementById('unlock-target-id').value = targetId;

    const form = document.getElementById('unlock-request-form');
    form.onsubmit = async (e) => {
        e.preventDefault();

        const message = document.getElementById('unlock-message').value.trim();
        if (!message) {
            alert('메시지를 입력해주세요.');
            return;
        }

        const request = {
            id: 'request_' + Date.now(),
            requesterId: currentUser.id,
            targetId: targetId,
            message: message,
            status: 'pending',
            createdAt: Date.now()
        };

        await saveUnlockRequest(request);

        // Send Discord Notification
        try {
            await sendDiscordNotification(request, currentUser, targetId);
        } catch (error) {
            console.error('Failed to send Discord notification:', error);
        }

        // Create Notification for Requester
        await saveNotification({
            userId: currentUser.id,
            type: 'unlock_request_sent',
            message: '관리자에게 프로필 공개 요청을 보냈습니다.',
            targetId: targetId,
            read: false,
            createdAt: Date.now()
        });

        document.getElementById('unlock-modal').classList.remove('active');
        document.getElementById('unlock-message').value = '';

        alert('공개 요청이 전송되었습니다. 관리자 승인 후 프로필을 확인할 수 있습니다.');
    };
}

// Global function for opening edit profile modal
function openEditProfileModal() {
    // Close the profile modal
    document.getElementById('profile-modal').classList.remove('active');

    // Open edit profile modal
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.add('active');

    // Populate form with current user data
    populateEditProfileForm();

    // Setup photo upload handlers
    setupEditPhotoUpload();

    // Setup location dropdown handler
    const locationSelect = document.getElementById('edit-location');
    const customLocationGroup = document.getElementById('edit-custom-location-group');
    const customLocationInput = document.getElementById('edit-custom-location');

    locationSelect.addEventListener('change', () => {
        if (locationSelect.value === '기타') {
            customLocationGroup.style.display = 'block';
            customLocationInput.required = true;
        } else {
            customLocationGroup.style.display = 'none';
            customLocationInput.required = false;
            customLocationInput.value = '';
        }
    });

    // Setup form submission
    const form = document.getElementById('edit-profile-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        await handleEditProfileSubmit();
    };

    // Setup close button
    modal.querySelector('.modal-close').onclick = () => {
        modal.classList.remove('active');
    };

    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    };
}

function populateEditProfileForm() {
    if (!currentUser) return;

    // Clear all hobbies first
    document.querySelectorAll('input[name="edit-hobbies"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Clear photo previews first
    document.querySelectorAll('.photo-preview-edit').forEach(preview => {
        preview.classList.remove('active');
        preview.innerHTML = '';
    });

    // Populate photos
    currentUser.photos.forEach((photo, index) => {
        const preview = document.querySelector(`.photo-upload-box[data-index="${index}"] .photo-preview-edit`);
        if (preview) {
            preview.innerHTML = `<img src="${photo}" alt="Photo ${index + 1}">`;
            preview.classList.add('active');

            // Make photo clickable to change
            preview.style.cursor = 'pointer';
            preview.onclick = () => {
                const input = document.getElementById(`photo-edit-${index}`);
                if (input) input.click();
            };
        }
    });

    // Populate basic info
    document.getElementById('edit-name').value = currentUser.name || '';
    document.getElementById('edit-birth-year').value = currentUser.birthYear || '';
    document.getElementById('edit-religion').value = currentUser.religion || '';
    document.getElementById('edit-height').value = currentUser.height;
    document.getElementById('edit-body-type').value = currentUser.bodyType || '';
    document.getElementById('edit-drinking').value = currentUser.drinking || '';
    document.getElementById('edit-job').value = currentUser.job || '';
    document.getElementById('edit-workplace').value = currentUser.workplace || '';
    document.getElementById('edit-high-school').value = currentUser.highSchool || '';

    // Handle location
    const locationSelect = document.getElementById('edit-location');
    const customLocationGroup = document.getElementById('edit-custom-location-group');
    const customLocationInput = document.getElementById('edit-custom-location');

    const locationOptions = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '김해', '창원', '포항'];
    if (locationOptions.includes(currentUser.location)) {
        locationSelect.value = currentUser.location;
    } else {
        locationSelect.value = '기타';
        customLocationGroup.style.display = 'block';
        customLocationInput.value = currentUser.location;
        customLocationInput.required = true;
    }

    // Populate smoking
    if (currentUser.smoking === '비흡연') {
        document.getElementById('edit-smoking-no').checked = true;
    } else {
        document.getElementById('edit-smoking-yes').checked = true;
    }

    document.getElementById('edit-mbti').value = currentUser.mbti || '';
    document.getElementById('edit-marriage-plan').value = currentUser.marriagePlan || '';

    // Populate hobbies
    if (currentUser.hobbies && Array.isArray(currentUser.hobbies)) {
        currentUser.hobbies.forEach(hobby => {
            const checkbox = document.querySelector(`input[name="edit-hobbies"][value="${hobby}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // Populate contact info
    document.getElementById('edit-kakao-id').value = currentUser.contactKakao || '';
    document.getElementById('edit-instagram-id').value = currentUser.contactInstagram || '';
}

function setupEditPhotoUpload() {
    document.querySelectorAll('.photo-input-edit').forEach((input, index) => {
        // Remove existing listeners by cloning
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);

        newInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('사진 크기는 5MB 이하여야 합니다.');
                    return;
                }

                // Compress image before storing
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        // Create canvas for compression
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        // Calculate new dimensions (max 800px on longest side)
                        let width = img.width;
                        let height = img.height;
                        const maxSize = 800;

                        if (width > height && width > maxSize) {
                            height = (height * maxSize) / width;
                            width = maxSize;
                        } else if (height > maxSize) {
                            width = (width * maxSize) / height;
                            height = maxSize;
                        }

                        canvas.width = width;
                        canvas.height = height;

                        // Draw and compress
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality

                        // Display preview
                        const preview = document.querySelector(`.photo-upload-box[data-index="${index}"] .photo-preview-edit`);
                        preview.innerHTML = `<img src="${compressedDataUrl}" alt="Photo ${index + 1}">`;
                        preview.classList.add('active');
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

async function handleEditProfileSubmit() {
    // Validate photos (ensure three photos are uploaded)
    const photos = [];
    for (let i = 0; i < 3; i++) {
        const preview = document.querySelector(`.photo-upload-box[data-index="${i}"] .photo-preview-edit`);
        if (!preview.classList.contains('active')) {
            alert('사진 3장을 모두 등록해주세요.');
            return;
        }
        photos.push(preview.querySelector('img').src);
    }

    // Get selected hobbies
    const hobbies = Array.from(document.querySelectorAll('input[name="edit-hobbies"]:checked')).map(cb => cb.value);
    if (hobbies.length === 0) {
        alert('취미를 최소 1개 이상 선택해주세요.');
        return;
    }

    // Validate MBTI (must be 4 characters)
    const mbti = document.getElementById('edit-mbti').value.toUpperCase();
    if (mbti.length !== 4) {
        alert('MBTI는 4자리로 입력해주세요 (예: INFP)');
        return;
    }

    const birthYear = parseInt(document.getElementById('edit-birth-year').value);
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear + 1; // Korean age calculation

    // Update currentUser object
    currentUser.name = document.getElementById('edit-name').value;
    currentUser.birthYear = birthYear;
    currentUser.age = age;
    currentUser.religion = document.getElementById('edit-religion').value;
    currentUser.height = parseInt(document.getElementById('edit-height').value);
    currentUser.bodyType = document.getElementById('edit-body-type').value;
    currentUser.drinking = document.getElementById('edit-drinking').value;
    currentUser.hobbies = hobbies;
    currentUser.job = document.getElementById('edit-job').value;
    currentUser.workplace = document.getElementById('edit-workplace').value;
    currentUser.highSchool = document.getElementById('edit-high-school').value;
    currentUser.location = document.getElementById('edit-location').value === '기타'
        ? document.getElementById('edit-custom-location').value
        : document.getElementById('edit-location').value;
    currentUser.smoking = document.querySelector('input[name="edit-smoking"]:checked').value;
    currentUser.mbti = mbti;
    currentUser.marriagePlan = document.getElementById('edit-marriage-plan').value;
    currentUser.contactInstagram = document.getElementById('edit-instagram-id').value;
    currentUser.photos = photos;

    try {
        // Save to Firestore
        await saveUser(currentUser);

        alert('프로필이 성공적으로 수정되었습니다!');

        // Close modal
        document.getElementById('edit-profile-modal').classList.remove('active');

        // Refresh matches page to show updated profile
        window.dispatchEvent(new CustomEvent('showMatches'));
    } catch (error) {
        console.error('Profile update error:', error);
        alert('프로필 수정 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}


// Matching Algorithm
// Matching Algorithm
async function findMatches(user) {
    console.log('--- findMatches called ---');

    // Fallback to global currentUser if user argument is missing preferences
    let matchingUser = user;
    if (!matchingUser || !matchingUser.preferences || Object.keys(matchingUser.preferences).length === 0) {
        console.warn('User argument has no preferences, checking global currentUser...');
        if (currentUser && currentUser.preferences && Object.keys(currentUser.preferences).length > 0) {
            console.log('Using global currentUser instead');
            matchingUser = currentUser;
        } else {
            console.error('Global currentUser also has no preferences! Fetching from Firestore...');
            try {
                // Try to fetch fresh user data
                const freshUser = await getUser(user.id || currentUser.id);
                if (freshUser && freshUser.preferences && Object.keys(freshUser.preferences).length > 0) {
                    console.log('Fetched fresh user data with preferences');
                    matchingUser = freshUser;
                    // Update global currentUser
                    currentUser = freshUser;
                } else {
                    console.error('Failed to fetch user preferences from Firestore');
                }
            } catch (e) {
                console.error('Error fetching fresh user data:', e);
            }
        }
    }

    console.log('Matching User:', matchingUser ? matchingUser.name : 'Unknown');

    // Check if preferences exist AND are not empty
    if (!matchingUser || !matchingUser.preferences || Object.keys(matchingUser.preferences).length === 0) {
        console.warn('User has no preferences set (empty priorities list).');
        console.log('Current matchingUser state:', matchingUser);

        // Alert the user to set preferences
        if (confirm('선호 조건이 설정되지 않았습니다. 선호 조건 설정 페이지로 이동하시겠습니까?')) {
            showPage('preference-page');
            window.dispatchEvent(new CustomEvent('setupPreferences'));
        }

        return []; // Stop matching process
    }

    console.log('--- User Preferences ---');
    // Use JSON.stringify for guaranteed output in all consoles
    console.log(JSON.stringify(matchingUser.preferences, null, 2));
    console.log('------------------------');

    const allUsers = await fetchUsers();
    const candidates = allUsers.filter(u =>
        u.id !== matchingUser.id && u.gender !== matchingUser.gender
    );

    const matches = candidates.map(candidate => {
        const scoreData = calculateMatchScore(matchingUser, candidate);
        return { user: candidate, score: scoreData.percentage, priorityScore: scoreData.priorityScore };
    });

    // Sort by percentage first, then by priority score (higher priority matches first)
    matches.sort((a, b) => {
        if (b.score === a.score) {
            return b.priorityScore - a.priorityScore; // Same percentage: higher priority score first
        }
        return b.score - a.score; // Different percentage: higher percentage first
    });

    console.log('\n=== Final Match Results (Top 10) ===');
    matches.slice(0, 10).forEach((m, i) => {
        console.log(`#${i + 1} ${m.user.name} | Score: ${m.score}% | Priority Score: ${m.priorityScore}`);
        console.log('   Candidate Info:', {
            birthYear: m.user.birthYear,
            height: m.user.height,
            mbti: m.user.mbti,
            religion: m.user.religion,
            drinking: m.user.drinking,
            smoking: m.user.smoking,
            hobbies: m.user.hobbies,
            job: m.user.job,
            location: m.user.location
        });
    });
    console.log('====================================\n');

    return matches;
}

function calculateMatchScore(user, candidate) {
    // Ensure preferences are stored as a map (field -> {value, ...})
    if (!user || !user.preferences || Object.keys(user.preferences).length === 0) {
        console.error('ERROR: No preferences set for user in calculateMatchScore');
        return { percentage: 0, priorityScore: 0 };
    }

    let matchedCount = 0;
    let priorityScore = 0;
    const prefEntries = Object.entries(user.preferences);
    const totalCount = prefEntries.length;

    prefEntries.forEach(([fieldId, pref]) => { // Changed index to fieldId for clarity
        const isMatch = matchesPreference(candidate, fieldId, pref);
        if (isMatch) {
            matchedCount++;
            priorityScore += pref.priority; // Use the stored priority from the preference object
        }
    });

    const percentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
    return { percentage, priorityScore };
}

function matchesPreference(candidate, fieldId, pref) {
    // pref is already the preference object from the map (contains value, label, priority)
    if (!pref) {
        console.warn(`Preference object missing for field: ${fieldId}`);
        return false;
    }
    if (pref.value === undefined || pref.value === null) {
        console.warn(`Preference value is missing for field: ${fieldId}`, pref);
        return false;
    }

    // Type-specific matching logic (range, multi, select, text, etc.)
    const candVal = candidate[fieldId];
    const prefVal = pref.value;

    // Range (object with min/max)
    if (typeof prefVal === 'object' && prefVal.min !== undefined) {
        return candVal >= prefVal.min && candVal <= prefVal.max;
    }
    // Multi-select (array)
    if (Array.isArray(prefVal)) {
        // For hobbies, check if candidate has ANY of the preferred hobbies
        if (fieldId === 'hobbies') {
            return prefVal.some(h => candVal && candVal.includes(h));
        }
        // For other multi-selects (like religion, bodyType), check if candidate's single value is in preferred list
        return prefVal.includes(candVal);
    }
    // Default – direct equality (for select, text, etc.)
    // Special handling for MBTI to support multiple values (comma-separated) and case-insensitive
    if (fieldId === 'mbti') {
        const candMbti = String(candVal).toUpperCase().trim();
        // prefVal can be a comma-separated list like "INFP,ENTP,ISTP"
        const prefMbtis = String(prefVal).toUpperCase().split(',').map(m => m.trim());
        return prefMbtis.includes(candMbti);
    }
    return candVal === prefVal;
}

// Admin Functions
function showAdminLogin() {
    showPage('admin-login-page');

    const form = document.getElementById('admin-login-form');
    const errorDiv = document.getElementById('admin-error');

    form.onsubmit = async (e) => {
        e.preventDefault();
        let email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-password').value;
        const errorMsg = document.getElementById('admin-error');
        errorMsg.style.display = 'none';

        // If simple ID is provided, append domain to make it a valid email for Firebase Auth
        if (!email.includes('@')) {
            email = email + '@matching.app';
        }

        try {
            // Try to sign in
            await auth.signInWithEmailAndPassword(email, password);

            // Login successful
            localStorage.setItem(STORAGE_KEYS.ADMIN_LOGGED_IN, 'true');
            showAdminDashboard();

        } catch (error) {
            console.error('Admin login error:', error);

            // For development convenience: Create admin account if not found
            // Only allow creation for the specific 'admin' ID to prevent multiple admin accounts
            // Note: Newer Firebase Auth returns 'auth/invalid-login-credentials' or 'auth/invalid-credential' instead of specific user-not-found
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials' || error.code === 'auth/invalid-credential') {
                // Only allow 'admin' ID to create the account
                if (email === 'admin@matching.app') {
                    try {
                        // First try to create user directly. If it fails because it exists (wrong password case), catch that.
                        // But we can't distinguish "wrong password" from "user not found" easily with the new error code without trying.
                        // So we'll ask the user if they want to create/reset.

                        // However, if the user exists but password is wrong, createUser will fail with 'auth/email-already-in-use'.
                        // So we can try to create it.

                        if (confirm('관리자 계정 로그인을 시도했으나 실패했습니다.\n\n초기 관리자 계정(admin)이 없다면 생성하시겠습니까?\n(이미 계정이 있다면 취소 후 비밀번호를 확인하세요)')) {
                            await auth.createUserWithEmailAndPassword(email, password);
                            localStorage.setItem(STORAGE_KEYS.ADMIN_LOGGED_IN, 'true');
                            showAdminDashboard();
                            return;
                        }
                    } catch (createError) {
                        console.error('Error creating admin:', createError);
                        if (createError.code === 'auth/email-already-in-use') {
                            errorMsg.textContent = '이미 존재하는 계정입니다. 비밀번호를 확인하세요.';
                        } else {
                            errorMsg.textContent = '관리자 계정 생성 실패: ' + createError.message;
                        }
                        errorMsg.style.display = 'block';
                        return;
                    }
                }
            }

            let msg = '로그인 실패';
            if (error.code === 'auth/wrong-password') {
                msg = '비밀번호가 올바르지 않습니다.';
            } else if (error.code === 'auth/invalid-email') {
                msg = '유효하지 않은 이메일 형식입니다.';
            } else if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/invalid-credential') {
                msg = '아이디가 없거나 비밀번호가 올바르지 않습니다.';
            }
            errorMsg.textContent = msg;
            errorMsg.style.display = 'block';
        }
    };
}

async function showAdminDashboard() {
    showPage('admin-dashboard-page');

    // Logout button
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_LOGGED_IN);
        auth.signOut().then(() => {
            alert('로그아웃되었습니다.');
        }).catch((error) => {
            console.error('Logout error:', error);
        });
        window.location.hash = '';
        location.reload();
    });

    // Setup tabs
    setupAdminTabs();

    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const contentId = tab.dataset.tab + '-tab';
            document.getElementById(contentId).classList.add('active');

            if (tab.dataset.tab === 'profiles') {
                displayAllProfiles();
            } else if (tab.dataset.tab === 'completed') {
                displayCompletedRequests();
            } else {
                displayUnlockRequests();
            }
        });
    });

    await displayUnlockRequests();
}

function setupAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding content
            document.querySelectorAll('.admin-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

async function displayUnlockRequests() {
    const requests = await fetchUnlockRequests();
    const users = await fetchUsers();
    const grid = document.getElementById('admin-requests-grid');
    const noRequests = document.getElementById('no-requests');

    const pendingRequests = requests.filter(r => r.status === 'pending');

    // Update pending count
    const pendingCount = document.getElementById('pending-count');
    if (pendingCount) {
        pendingCount.textContent = pendingRequests.length;
    }

    if (pendingRequests.length === 0) {
        grid.style.display = 'none';
        noRequests.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    noRequests.style.display = 'none';

    grid.innerHTML = pendingRequests.map(request => {
        const requester = users.find(u => u.id === request.requesterId);
        const target = users.find(u => u.id === request.targetId);

        if (!requester || !target) return '';

        return `
            <div class="request-card">
                <div class="request-header">
                    <span class="request-time">${new Date(request.createdAt).toLocaleString()}</span>
                    <span class="status-badge status-pending">대기중</span>
                </div>
                <div class="request-users">
                    <div class="request-user">
                        <strong>요청자:</strong> ${requester.name}
                    </div>
                    <div class="arrow">→</div>
                    <div class="request-user">
                        <strong>대상:</strong> ${target.name}
                    </div>
                </div>
                <div class="request-message">
                    "${request.message}"
                </div>
                <div class="request-actions">
                    <button class="btn-approve" onclick="approveRequest('${request.id}')">승인</button>
                    <button class="btn-reject" onclick="rejectRequest('${request.id}')">거절</button>
                </div>
            </div>
        `;
    }).join('');
}

async function displayCompletedRequests() {
    const requests = await fetchUnlockRequests();
    const users = await fetchUsers();
    const grid = document.getElementById('admin-completed-grid');
    const noCompleted = document.getElementById('no-completed');

    const completedRequests = requests.filter(r => r.status === 'approved' || r.status === 'rejected');

    // Update completed count
    const completedCount = document.getElementById('completed-count');
    if (completedCount) {
        completedCount.textContent = completedRequests.length;
    }

    if (completedRequests.length === 0) {
        grid.style.display = 'none';
        noCompleted.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    noCompleted.style.display = 'none';

    // Sort by reviewedAt (most recent first)
    completedRequests.sort((a, b) => (b.reviewedAt || 0) - (a.reviewedAt || 0));

    grid.innerHTML = completedRequests.map(request => {
        const requester = users.find(u => u.id === request.requesterId);
        const target = users.find(u => u.id === request.targetId);

        if (!requester || !target) return '';

        const isApproved = request.status === 'approved';
        const statusClass = isApproved ? 'status-approved' : 'status-rejected';
        const statusText = isApproved ? '승인됨' : '거절됨';
        const statusIcon = isApproved ? '✅' : '❌';

        return `
            <div class="request-card ${statusClass}">
                <div class="request-header">
                    <span class="request-time">요청: ${new Date(request.createdAt).toLocaleString()}</span>
                    <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span>
                </div>
                <div class="request-header" style="margin-top: 0.5rem;">
                    <span class="request-time" style="font-size: 0.85rem; opacity: 0.8;">처리: ${new Date(request.reviewedAt).toLocaleString()}</span>
                </div>
                <div class="request-users">
                    <div class="request-user">
                        <strong>요청자:</strong> ${requester.name}
                    </div>
                    <div class="arrow">→</div>
                    <div class="request-user">
                        <strong>대상:</strong> ${target.name}
                    </div>
                </div>
                <div class="request-message">
                    "${request.message}"
                </div>
            </div>
        `;
    }).join('');
}

async function displayAllProfiles() {
    const users = await fetchUsers();
    const grid = document.getElementById('admin-profiles-grid');
    const totalCount = document.getElementById('total-count');

    if (totalCount) {
        totalCount.textContent = users.length;
    }

    grid.innerHTML = users.map(user => `
        <div class="admin-profile-card">
            <div class="profile-photos">
                ${user.photos ? user.photos.slice(0, 3).map(photo => `
                    <div class="profile-photo">
                        <img src="${photo}" alt="Profile photo">
                    </div>
                `).join('') : '<p>사진 없음</p>'}
            </div>
            <h3>${user.name || '이름 없음'}</h3>
            <div class="profile-info-grid">
                <div class="detail-item">
                    <div class="detail-label">출생년도</div>
                    <div class="detail-value">${user.birthYear || 'N/A'}년생 (${user.age || 'N/A'}세)</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">성별</div>
                    <div class="detail-value">${user.gender === 'male' ? '남성' : user.gender === 'female' ? '여성' : 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">종교</div>
                    <div class="detail-value">${user.religion || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">키</div>
                    <div class="detail-value">${user.height || 'N/A'}cm</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">음주</div>
                    <div class="detail-value">${user.drinking || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">직업</div>
                    <div class="detail-value">${user.job || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">직장명</div>
                    <div class="detail-value">${user.workplace || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">고등학교</div>
                    <div class="detail-value">${user.highSchool || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">거주지</div>
                    <div class="detail-value">${user.location || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">흡연</div>
                    <div class="detail-value">${user.smoking || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">MBTI</div>
                    <div class="detail-value">${user.mbti || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">결혼 계획</div>
                    <div class="detail-value">${user.marriagePlan || 'N/A'}</div>
                </div>
            </div>
            <div class="match-hobbies">
                ${user.hobbies && user.hobbies.length > 0 ? user.hobbies.map(hobby => `<span class="hobby-tag">${hobby}</span>`).join('') : '<span>취미 정보 없음</span>'}
            </div>
            <div class="contact-info">
                <h4>📞 연락처</h4>
                <div class="contact-item">
                    <strong>카카오톡:</strong>
                    <span>${user.contactKakao || 'N/A'}</span>
                </div>
                <div class="contact-item">
                    <strong>인스타그램:</strong>
                    <span>${user.contactInstagram || 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function approveRequest(requestId) {
    const requests = await fetchUnlockRequests();
    const request = requests.find(r => r.id === requestId);

    if (request) {
        try {
            request.status = 'approved';
            request.reviewedAt = Date.now();
            await saveUnlockRequest(request);

            // Add to unlocked profiles
            await addUnlockedProfile(request.requesterId, request.targetId);

            // Create Notification for Requester
            await saveNotification({
                userId: request.requesterId,
                type: 'unlock_approved',
                message: '관리자가 프로필 공개 요청을 승인했습니다.',
                targetId: request.targetId,
                read: false,
                createdAt: Date.now()
            });

            alert('승인되었습니다.');
            displayUnlockRequests();
            // Update completed count
            const requests = await fetchUnlockRequests();
            const completedCount = document.getElementById('completed-count');
            if (completedCount) {
                const completed = requests.filter(r => r.status === 'approved' || r.status === 'rejected');
                completedCount.textContent = completed.length;
            }
        } catch (error) {
            console.error('Error approving request:', error);
            alert('승인 처리 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
    }
}

async function rejectRequest(requestId) {
    const requests = await fetchUnlockRequests();
    const request = requests.find(r => r.id === requestId);

    if (request) {
        request.status = 'rejected';
        request.reviewedAt = Date.now();
        await saveUnlockRequest(request);

        alert('거절되었습니다.');
        displayUnlockRequests();
        // Update completed count
        const allRequests = await fetchUnlockRequests();
        const completedCount = document.getElementById('completed-count');
        if (completedCount) {
            const completed = allRequests.filter(r => r.status === 'approved' || r.status === 'rejected');
            completedCount.textContent = completed.length;
        }
    }
}

// Data Management
// Data Access Functions (Firestore)

async function fetchUsers() {
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => doc.data());
        console.log('Fetched users from Firestore:', users);
        users.forEach(user => {
            console.log(`User ${user.contactKakao} - password field:`, user.password);
        });
        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

// Save user with partial update (merge) to avoid overwriting whole document
async function saveUser(user) {
    try {
        console.log('Saving user to Firestore (merge):', user.id);
        // Use merge:true so only provided fields are updated
        await db.collection('users').doc(user.id).set(user, { merge: true });
        console.log('User saved (merged) successfully');
    } catch (error) {
        console.error("Error saving user:", error);
        alert('저장 중 오류가 발생했습니다.');
    }
}

async function fetchUnlockRequests() {
    try {
        const snapshot = await db.collection('unlock_requests').get();
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error fetching requests:", error);
        return [];
    }
}


async function saveUnlockRequest(request) {
    try {
        await db.collection('unlock_requests').doc(request.id).set(request);
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn("Unlock request permission denied. Please update Firestore Security Rules.");
            alert('권한 오류: 관리자에게 문의하세요. (Firestore Rules Update Required)');
        } else {
            console.error("Error saving request:", error);
            alert('요청 저장 중 오류가 발생했습니다.');
        }
    }
}

// Notification Functions
async function saveNotification(notification) {
    try {
        await db.collection('notifications').add(notification);
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn("Notification permission denied. Please update Firestore Security Rules.");
        } else {
            console.error("Error saving notification:", error);
        }
    }
}

async function fetchNotifications(userId) {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        // Handle missing index error
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            console.warn('Firestore index required for notifications. Create it at:', error.message.match(/https:\/\/[^\s]+/)?.[0]);
            // Return empty array until index is created
            return [];
        }
        // Silently handle permission errors (notifications feature may not be set up yet)
        if (error.code !== 'permission-denied') {
            console.error("Error fetching notifications:", error);
        }
        return [];
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({ read: true });
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

function displayNotifications(notifications) {
    const list = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');

    if (notifications.length === 0) {
        list.innerHTML = '<div class="empty-notifications">알림이 없습니다.</div>';
        badge.style.display = 'none';
        return;
    }

    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.id}', '${n.type}', '${n.targetId}')">
            <div class="notification-header">
                <span>${new Date(n.createdAt).toLocaleDateString()}</span>
                ${!n.read ? '<span style="color: var(--primary);">●</span>' : ''}
            </div>
            <div class="notification-content">${n.message}</div>
            ${n.type === 'unlock_approved' ? `
                <div class="notification-action">
                    <button class="notification-btn">프로필 보기</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function handleNotificationClick(notificationId, type, targetId) {
    await markNotificationAsRead(notificationId);

    // Refresh notifications to update UI
    const notifications = await fetchNotifications(currentUser.id);
    displayNotifications(notifications);

    if (type === 'unlock_approved') {
        document.getElementById('notification-modal').style.display = 'none';

        // Fetch the target user and show their profile
        try {
            const userDoc = await db.collection('users').doc(targetId).get();
            if (userDoc.exists) {
                const targetUser = userDoc.data();
                // Trigger event to show profile modal
                window.dispatchEvent(new CustomEvent('showUnlockedProfile', {
                    detail: { user: targetUser }
                }));
            }
        } catch (error) {
            console.error('Error fetching unlocked profile:', error);
            alert('프로필을 불러오는 중 오류가 발생했습니다.');
        }
    }
}

// Toast Notification
function showToast(message, onClick) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    if (onClick) {
        toast.onclick = onClick;
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-in reverse';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

async function fetchUnlockedProfiles(userId) {
    try {
        const doc = await db.collection('unlockedProfiles').doc(userId).get();
        if (doc.exists) {
            return doc.data().unlocked || [];
        }
        return [];
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn("Unlocked profiles permission denied. Please update Firestore Security Rules.");
        } else {
            console.error("Error fetching unlocked profiles:", error);
        }
        return [];
    }
}

async function addUnlockedProfile(userId, targetId) {
    try {
        console.log('Adding unlocked profile:', { userId, targetId });
        const docRef = db.collection('unlockedProfiles').doc(userId);
        // Directly add targetId using set with merge (no read needed)
        await docRef.set({
            unlocked: firebase.firestore.FieldValue.arrayUnion(targetId)
        }, { merge: true });
        console.log('Added/updated unlocked profile for user:', userId);
    } catch (error) {
        console.error('Error adding unlocked profile:', error);
        if (error.code === 'permission-denied') {
            if (auth.currentUser) {
                console.error('PERMISSION DENIED: User is authenticated but rule rejected write.');
                alert('권한 오류: Firestore 보안 규칙이 업데이트되지 않았습니다.\n\n터미널에서 "firebase deploy --only firestore:rules"를 실행하거나 Firebase Console에서 규칙을 수정해주세요.');
            } else {
                console.error('PERMISSION DENIED: Admin is not authenticated with Firebase Auth!');
                alert('권한 오류: 관리자 인증 정보가 없습니다. 새로고침 후 다시 로그인해주세요.');
            }
        }
        throw error;
    }
}

async function updateUserCount() {
    const userCountElement = document.getElementById('total-users-count');
    if (userCountElement) {
        // Only fetch user count if authenticated
        if (auth.currentUser) {
            const users = await fetchUsers();
            userCountElement.textContent = users.length;
        } else {
            // Show placeholder for unauthenticated users
            userCountElement.textContent = '...';
        }
    }
}

// Discord Notification
async function sendDiscordNotification(request, requester, targetId) {
    const users = await fetchUsers();
    const target = users.find(u => u.id === targetId);

    const webhookUrl = "https://discord.com/api/webhooks/1442381314396393624/McRV-roltEVoO6x4MQSsWmleG0wYOEK_0XK74ezzTqK4x1jcR62uzxEf4gq6DfqAC9jv";
    const adminUrl = window.location.origin + '/#admin';

    const payload = {
        embeds: [{
            title: "🔐 새로운 프로필 공개 요청",
            description: `[👉 관리자 페이지 바로가기](${adminUrl})`,
            color: 0xFF69B4, // Hot Pink
            fields: [
                {
                    name: "요청자",
                    value: `${requester.name} (${requester.age}세, ${requester.gender === 'male' ? '남성' : '여성'})`,
                    inline: true
                },
                {
                    name: "대상",
                    value: `${target ? target.name : '알 수 없음'} (${target ? target.age : '?'}세)`,
                    inline: true
                },
                {
                    name: "메시지",
                    value: request.message
                },
                {
                    name: "요청 시간",
                    value: new Date(request.createdAt).toLocaleString('ko-KR')
                }
            ],
            footer: {
                text: "관리자 페이지에서 승인해주세요"
            }
        }]
    };

    await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

async function sendNewUserDiscordNotification(user) {
    const webhookUrl = "https://discord.com/api/webhooks/1442381314396393624/McRV-roltEVoO6x4MQSsWmleG0wYOEK_0XK74ezzTqK4x1jcR62uzxEf4gq6DfqAC9jv";
    const adminUrl = window.location.origin + '/#admin';

    const payload = {
        embeds: [{
            title: "🎉 새로운 사용자 등록!",
            description: `[👉 관리자 페이지 바로가기](${adminUrl})`,
            color: 0x00FF00, // Green
            fields: [
                {
                    name: "이름",
                    value: `${user.name || '정보 없음'} (${user.birthYear}년생, ${user.gender === 'male' ? '남성' : '여성'})`,
                    inline: true
                },
                {
                    name: "직업",
                    value: user.job || '정보 없음',
                    inline: true
                },
                {
                    name: "거주지",
                    value: user.location || '정보 없음',
                    inline: true
                },
                {
                    name: "등록 시간",
                    value: new Date(user.registeredAt).toLocaleString('ko-KR')
                }
            ],
            footer: {
                text: "새로운 매칭 후보가 등장했습니다!"
            }
        }]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Discord webhook failed:', response.status, errorText);
        } else {
            console.log('Discord notification sent successfully');
        }
    } catch (error) {
        console.error("Discord notification failed:", error);
    }
}
