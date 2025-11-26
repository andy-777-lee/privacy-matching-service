// Main Application
// Note: Firebase config, constants, and utilities are now loaded from separate modules

// Global state
let currentUser = null;
window.currentUser = currentUser;

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

    // Setup modal close buttons (once on init)
    setupModalCloseButtons();
}


const hash = window.location.hash;

// Duplicate auth listener removed – initialization handled in initializeApp()

// Setup modal close buttons
function setupModalCloseButtons() {
    const modals = ['profile-modal', 'unlock-modal', 'edit-profile-modal', 'notification-modal', 'image-viewer-modal', 'service-info-modal'];

    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.warn(`Modal not found: ${modalId}`);
            return;
        }

        // Close button
        const closeBtn = modal.querySelector('.modal-close, .close-modal');
        if (closeBtn) {
            // Remove any existing listeners by cloning
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

            newCloseBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Closing modal: ${modalId}`);
                modal.classList.remove('active');
                // Do NOT set display: none here, let CSS handle it via .active class
                modal.style.display = '';
            };
        } else {
            console.warn(`Close button not found for modal: ${modalId}`);
        }

        // Click outside to close (except for unlock-modal)
        if (modalId !== 'unlock-modal') {
            modal.onclick = (e) => {
                if (e.target === modal) {
                    console.log(`Closing modal by background click: ${modalId}`);
                    modal.classList.remove('active');
                    // Do NOT set display: none here
                    modal.style.display = '';
                }
            };
        }
    });
}

function setupHashNavigation() {
    window.addEventListener('hashchange', () => {
        initializeApp();
    });
}

// Note: showPage and hashPassword are now in js/utils/helpers.js


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
            // Convert Kakao ID to safe email format using Base64 encoding (same as registration)
            const safeKakaoId = btoa(encodeURIComponent(kakaoId))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            const email = `${safeKakaoId}@matching.app`;

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

    // Update user count on login page
    updateLoginUserCount();
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
            // Convert Kakao ID to safe email format using Base64 encoding
            // This allows special characters in Kakao ID
            const safeKakaoId = btoa(encodeURIComponent(formData.contactKakao))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            const email = `${safeKakaoId}@matching.app`;

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

            // Set current user globally
            currentUser = user;
            window.currentUser = user;
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, user.id);

            alert('회원가입이 완료되었습니다!');

            // Navigate to preference page
            showPage('preference-page');
            // Trigger setup after a short delay to ensure page is rendered
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('setupPreferences'));
            }, 100);
        } catch (error) {
            console.error('Registration error:', error);
            // 상세 에러 메시지를 포함하여 디버깅을 돕습니다
            let msg = '회원가입 중 오류가 발생했습니다.\n' + (error.message || error);

            if (error.code === 'auth/email-already-in-use') {
                msg = '이미 등록된 카카오 ID입니다.';
            } else if (error.code === 'auth/weak-password') {
                msg = '비밀번호는 6자 이상이어야 합니다.'; // Firebase Auth requires 6+ chars
            } else if (error.code === 'permission-denied') {
                msg = '권한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
            } else if (error.code === 'auth/network-request-failed') {
                msg = '네트워크 연결 상태를 확인해주세요.';
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

    // Submit Preferences
    document.getElementById('submit-preferences').addEventListener('click', async () => {
        const selectGrid = document.getElementById('preference-select');
        const selected = Array.from(selectGrid.querySelectorAll('input:checked'))
            .map(cb => cb.value);

        if (selected.length === 0) {
            alert('최소 1개 이상의 조건을 선택해주세요.');
            return;
        }

        // Collect detailed values - ONLY for selected (checked) items
        const priorities = [];
        const listItems = document.querySelectorAll('#priority-list .priority-item');

        listItems.forEach((li, index) => {
            const fieldId = li.dataset.fieldId;

            // IMPORTANT: Only include if this field is actually selected (checked)
            if (!selected.includes(fieldId)) {
                console.log(`Skipping unchecked field: ${fieldId}`);
                return; // Skip this item
            }

            const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);
            if (!field) {
                console.warn(`Field not found: ${fieldId}`);
                return;
            }

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

        console.log('Saving preferences (filtered):', priorities);

        // Update existing user instead of creating new one
        if (currentUser) {
            try {
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

                console.log('New preferences to save:', prefMap);

                // Save preferences to Firestore (replace completely, not merge)
                // IMPORTANT: We use update() to replace only the preferences field
                await db.collection('users').doc(currentUser.id).update({
                    preferences: prefMap,
                    preferencesUpdatedAt: Date.now()
                });
                console.log('Saved preferences to Firestore successfully');

                // Reload user data from Firestore to ensure consistency
                const userDoc = await db.collection('users').doc(currentUser.id).get();
                if (userDoc.exists) {
                    currentUser = userDoc.data();
                    window.currentUser = currentUser; // Update global reference
                    console.log('Reloaded currentUser from Firestore:', currentUser);
                    console.log('Final preferences:', currentUser.preferences);
                }

                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUser.id);

                // Show matches page and immediately display matches
                showPage('matches-page');

                // Immediately trigger match display (no delay)
                window.dispatchEvent(new CustomEvent('showMatches'));
            } catch (error) {
                console.error('Error saving preferences:', error);
                alert('선호 조건 저장 중 오류가 발생했습니다: ' + error.message);
            }
        } else {
            alert('사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
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

// Note: Drag and drop functionality is now in js/utils/dragDrop.js




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
                    <span class="match-tag">${user.bodyType || '체격 정보 없음'}</span>
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
            ${user.photos.map((photo, index) => `
                <div class="profile-photo">
                    <img src="${photo}" class="${isUnlocked ? 'unlocked-photo' : 'blurred-photo'}" alt="Profile photo" data-photo-index="${index}" style="${isUnlocked ? 'cursor: pointer;' : ''}">
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
                <div class="info-label">체격</div>
                <div class="info-value">${user.bodyType}</div>
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
    modal.style.display = ''; // Ensure display is not none

    // Add click handlers for unlocked photos to open image viewer
    if (isUnlocked) {
        const photoImages = detail.querySelectorAll('.unlocked-photo');
        photoImages.forEach(img => {
            img.addEventListener('click', () => {
                openImageViewer(img.src);
            });
        });
    }

    // Note: Modal close buttons are handled by setupModalCloseButtons()
}

// Open image viewer modal
function openImageViewer(imageSrc) {
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const imageViewerImg = document.getElementById('image-viewer-img');

    imageViewerImg.src = imageSrc;
    imageViewerModal.classList.add('active');
    imageViewerModal.style.display = 'flex';
    imageViewerModal.style.alignItems = 'center';
    imageViewerModal.style.justifyContent = 'center';
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
    // Do not close profile modal, so unlock modal opens on top of it
    // document.getElementById('profile-modal').classList.remove('active');

    const modal = document.getElementById('unlock-modal');
    modal.classList.add('active');
    modal.style.display = ''; // Ensure display is not none
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

    // Note: Modal close buttons are now handled by setupModalCloseButtons()
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

// Note: requestUnlock is defined above
// Note: requestUnlock is defined above


// Global function for opening edit profile modal
function openEditProfileModal() {
    // Close the profile modal
    document.getElementById('profile-modal').classList.remove('active');

    // Open edit profile modal
    const modal = document.getElementById('edit-profile-modal');
    modal.classList.add('active');
    modal.style.display = ''; // Ensure display is not none

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

        // Update global reference
        window.currentUser = currentUser;

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


// Note: Matching algorithm is now in js/services/matching.js


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

    await Promise.all([
        displayUnlockRequests(),
        displayCompletedRequests(),
        displayAllProfiles()
    ]);
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

            // Refresh data when tab is clicked
            if (targetTab === 'profiles') {
                displayAllProfiles();
            } else if (targetTab === 'completed') {
                displayCompletedRequests();
            } else {
                displayUnlockRequests();
            }
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
        const requester = users.find(u => u.id === request.requesterId) || { name: '알 수 없음 (삭제됨)', id: request.requesterId };
        const target = users.find(u => u.id === request.targetId) || { name: '알 수 없음 (삭제됨)', id: request.targetId };

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
        const requester = users.find(u => u.id === request.requesterId) || { name: '알 수 없음 (삭제됨)', id: request.requesterId };
        const target = users.find(u => u.id === request.targetId) || { name: '알 수 없음 (삭제됨)', id: request.targetId };

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
            <button class="btn-reject" onclick="handleDeleteUser('${user.id}', '${user.name}')" style="width: 100%; margin-top: 1rem; padding: 0.8rem; background-color: #ff4b4b;">회원 삭제</button>
        </div>
    `).join('');
}

async function handleDeleteUser(userId, userName) {
    if (confirm(`정말로 ${userName} 회원을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        const success = await deleteUser(userId);
        if (success) {
            alert('회원이 삭제되었습니다.');
            displayAllProfiles(); // Refresh list
            updateUserCount(); // Update total count
        }
    }
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

// Note: Database functions are now in js/services/database.js
// Note: Notification functions are now in js/services/notifications.js
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

async function updateLoginUserCount() {
    const loginUserCountElement = document.getElementById('login-users-count');

    try {
        // Fetch user count from Firestore (public read access needed)
        const usersSnapshot = await db.collection('users').get();
        const userCount = usersSnapshot.size;

        if (loginUserCountElement) {
            loginUserCountElement.textContent = userCount;
        }
    } catch (error) {
        console.error('Error fetching user count:', error);
        if (loginUserCountElement) {
            loginUserCountElement.textContent = '...';
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

// Snowfall Effect
function createSnowflake() {
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    snowflake.innerHTML = '❄';

    // Random properties
    const startLeft = Math.random() * window.innerWidth;
    const animationDuration = Math.random() * 3 + 2; // 2-5 seconds
    const size = Math.random() * 10 + 10; // 10-20px
    const opacity = Math.random() * 0.5 + 0.3;

    snowflake.style.left = startLeft + 'px';
    snowflake.style.animationDuration = animationDuration + 's';
    snowflake.style.fontSize = size + 'px';
    snowflake.style.opacity = opacity;

    document.body.appendChild(snowflake);

    // Remove after animation
    setTimeout(() => {
        snowflake.remove();
    }, animationDuration * 1000);
}

// Start snowfall
setInterval(createSnowflake, 100);
