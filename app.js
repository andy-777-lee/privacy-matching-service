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

// Data Storage Keys (Legacy - keeping for admin login)
const STORAGE_KEYS = {
    ADMIN_LOGGED_IN: 'matchingService_adminLoggedIn'
};

const ADMIN_PASSWORD_HASH = 'b8b8eb83374c0bf3b1c3224159f6119dbfff1b7ed6dfecdd80d4e8a895790a34';

// Preference field definitions
const PREFERENCE_FIELDS = [
    { id: 'birthYear', label: '나이 (출생년도)', type: 'range' },
    { id: 'religion', label: '종교', type: 'select' },
    { id: 'height', label: '키', type: 'range' },
    { id: 'drinking', label: '음주', type: 'select' },
    { id: 'hobbies', label: '취미', type: 'multi' },
    { id: 'job', label: '직업/직군', type: 'select' },
    { id: 'education', label: '학력', type: 'select' },
    { id: 'location', label: '거주 지역', type: 'select' },
    { id: 'smoking', label: '흡연 여부', type: 'select' },
    { id: 'mbti', label: 'MBTI', type: 'text' },
    { id: 'marriagePlan', label: '결혼 계획', type: 'select' }
];

let draggedElement = null;
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupHashNavigation();
});

async function initializeApp() {
    // Ensure user is authenticated (anonymous login for Firestore security rules)
    try {
        if (!firebase.auth().currentUser) {
            await firebase.auth().signInAnonymously();
            console.log('Anonymous authentication successful');
        }
    } catch (error) {
        console.error('Anonymous authentication failed:', error);
        alert('인증에 실패했습니다. 페이지를 새로고침해주세요.');
        return;
    }

    const hash = window.location.hash;

    if (hash === '#admin') {
        if (localStorage.getItem(STORAGE_KEYS.ADMIN_LOGGED_IN) === 'true') {
            showAdminDashboard();
        } else {
            showAdminLogin();
        }
    } else {
        const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        if (userId) {
            const users = await fetchUsers();
            const user = users.find(u => u.id === userId);
            if (user) {
                currentUser = user;
                if (!user.preferences) {
                    showPage('preference-page');
                    setupPreferenceSelection();
                } else {
                    showPage('matches-page');
                    setupRegistrationForm(); // This will set up all nested functions including displayMatches
                }
                return;
            }
        }
        showPage('registration-page');
        setupRegistrationForm();
    }
}

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

// Registration Form
function setupRegistrationForm() {
    setupPhotoUpload();
    updateUserCount(); // Update user count on page load

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

        const formData = new FormData(form);
        const birthYear = parseInt(document.getElementById('birth-year').value);
        const currentYear = new Date().getFullYear();
        const age = currentYear - birthYear + 1; // Korean age calculation

        // Get location value (handle custom location)
        const locationSelect = document.getElementById('location');
        const location = locationSelect.value === '기타'
            ? document.getElementById('custom-location').value
            : locationSelect.value;

        const user = {
            id: Date.now().toString(),
            name: document.getElementById('name').value,
            gender: document.querySelector('input[name="gender"]:checked').value,
            birthYear: birthYear,
            age: age,
            religion: document.getElementById('religion').value,
            height: parseInt(document.getElementById('height').value),
            drinking: document.getElementById('drinking').value,
            hobbies: hobbies,
            job: document.getElementById('job').value,
            workplace: document.getElementById('workplace').value,
            education: document.getElementById('education').value,
            location: location,
            smoking: document.querySelector('input[name="smoking"]:checked').value,
            mbti: mbti,
            marriagePlan: document.getElementById('marriage-plan').value,
            contactKakao: document.getElementById('kakao-id').value,
            contactInstagram: document.getElementById('instagram-id').value,
            photos: photos,
            registeredAt: Date.now()
        };

        await saveUser(user);
        // Send Discord notification (non‑blocking)
        sendNewUserDiscordNotification(user).catch(console.error);
        currentUser = user;
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, user.id);

        alert('프로필이 등록되었습니다! 이제 이상형 조건을 설정해주세요.');
        showPage('preference-page');
        setupPreferenceSelection();
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

    function setupPreferenceSelection() {
        const selectGrid = document.getElementById('preference-select');
        const priorityCard = document.getElementById('priority-card');
        const priorityList = document.getElementById('priority-list');

        // Populate preference options
        selectGrid.innerHTML = PREFERENCE_FIELDS.map(field => `
        <div class="preference-option">
            <input type="checkbox" id="pref-${field.id}" value="${field.id}">
            <label for="pref-${field.id}">${field.label}</label>
        </div>
    `).join('');

        // Listen for checkbox changes
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

        // Setup form submission
        // Submit Preferences
        document.getElementById('submit-preferences').addEventListener('click', async () => {
            const selected = Array.from(selectGrid.querySelectorAll('input:checked'))
                .map(cb => cb.value);

            if (selected.length === 0) {
                alert('최소 1개 이상의 조건을 선택해주세요.');
                return;
            }

            // Collect detailed values
            const priorities = [];
            const listItems = document.querySelectorAll('#sortable-list li');

            listItems.forEach((li, index) => {
                const fieldId = li.dataset.id;
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

            // Update existing user instead of creating new one
            if (currentUser) {
                currentUser.preferences = {
                    priorities: priorities,
                    updatedAt: Date.now()
                };

                // Save to Firestore
                await saveUser(currentUser);

                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUser.id);
                showMatchesPage();
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

    function setupDragAndDrop() {
        const items = document.querySelectorAll('.priority-item');

        items.forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragenter', handleDragEnter);
            item.addEventListener('dragleave', handleDragLeave);
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

            if (field.type === 'range') {
                if (fieldId === 'birthYear') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <div class="range-input-group">
                            <input type="number" id="pref-value-${fieldId}-min" min="1920" max="2007" placeholder="최소" required>
                            <span>~</span>
                            <input type="number" id="pref-value-${fieldId}-max" min="1920" max="2007" placeholder="최대" required>
                        </div>
                    </div>
                `;
                } else if (fieldId === 'height') {
                    return `
                    <div class="form-group">
                        <label>${field.label} (cm)</label>
                        <div class="range-input-group">
                            <input type="number" id="pref-value-${fieldId}-min" min="140" max="220" placeholder="최소" required>
                            <span>~</span>
                            <input type="number" id="pref-value-${fieldId}-max" min="140" max="220" placeholder="최대" required>
                        </div>
                    </div>
                `;
                }
            } else if (field.type === 'select') {
                if (fieldId === 'religion') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            <option value="무교">무교</option>
                            <option value="기독교">기독교</option>
                            <option value="천주교">천주교</option>
                            <option value="불교">불교</option>
                            <option value="기타">기타</option>
                        </select>
                    </div>
                `;
                } else if (fieldId === 'drinking') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            <option value="안 마심">안 마심</option>
                            <option value="가끔">가끔</option>
                            <option value="자주">자주</option>
                        </select>
                    </div>
                `;
                } else if (fieldId === 'job') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            <option value="학생">학생</option>
                            <option value="직장인">직장인</option>
                            <option value="자영업">자영업</option>
                            <option value="프리랜서">프리랜서</option>
                            <option value="기타">기타</option>
                        </select>
                    </div>
                `;
                } else if (fieldId === 'education') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            <option value="고졸">고졸</option>
                            <option value="전문대졸">전문대졸</option>
                            <option value="대졸">대졸</option>
                            <option value="대학원">대학원</option>
                        </select>
                    </div>
                `;
                } else if (fieldId === 'location') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            <option value="서울">서울</option>
                            <option value="경기">경기</option>
                            <option value="인천">인천</option>
                            <option value="부산">부산</option>
                            <option value="대구">대구</option>
                            <option value="광주">광주</option>
                            <option value="대전">대전</option>
                            <option value="울산">울산</option>
                            <option value="김해">김해</option>
                            <option value="창원">창원</option>
                            <option value="포항">포항</option>
                        </select>
                    </div>
                `;
                } else if (fieldId === 'smoking') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            <option value="비흡연">비흡연</option>
                            <option value="흡연">흡연</option>
                        </select>
                    </div>
                `;
                } else if (fieldId === 'marriagePlan') {
                    return `
                    <div class="form-group">
                        <label>${field.label}</label>
                        <select id="pref-value-${fieldId}" required>
                            <option value="">선택해주세요</option>
                            <option value="1년 내">1년 내</option>
                            <option value="2-3년 내">2-3년 내</option>
                            <option value="천천히">천천히</option>
                            <option value="미정">미정</option>
                        </select>
                    </div>
                `;
                }
            } else if (field.type === 'multi' && fieldId === 'hobbies') {
                return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <div class="hobby-grid">
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="운동">
                            <span>운동</span>
                        </label>
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="영화">
                            <span>영화</span>
                        </label>
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="음악">
                            <span>음악</span>
                        </label>
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="독서">
                            <span>독서</span>
                        </label>
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="여행">
                            <span>여행</span>
                        </label>
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="요리">
                            <span>요리</span>
                        </label>
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="게임">
                            <span>게임</span>
                        </label>
                        <label class="hobby-option">
                            <input type="checkbox" name="pref-value-${fieldId}" value="기타">
                            <span>기타</span>
                        </label>
                    </div>
                </div>
            `;
            } else if (field.type === 'text' && fieldId === 'mbti') {
                return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <input type="text" id="pref-value-${fieldId}" maxlength="4" placeholder="예: INFP" required>
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
    }

    async function displayMatches() {
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
                <button onclick="showPage('preference-page')" class="btn-secondary" style="margin-top: 1rem;">선호 조건 수정하기</button>
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
        <div class="match-card" data-user-id="${user.id}">
            <div class="match-photos">
                <span class="match-percentage">${score}% 매칭</span>
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
                    <span class="match-tag">${user.education || '정보 없음'}</span>
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
    async function showProfileModal(user, showUnlockButton = false, matchScore = null, isOwnProfile = false) {
        const modal = document.getElementById('profile-modal');
        const detail = document.getElementById('profile-detail');

        const unlockedProfiles = await fetchUnlockedProfiles(currentUser.id);
        const isUnlocked = unlockedProfiles.includes(user.id) || isOwnProfile; // Own profile is always unlocked

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
                <div class="info-label">학력</div>
                <div class="info-value">${user.education}</div>
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
            <button class="btn btn-secondary btn-large" onclick="editPreferences()">
                선호 조건 수정하기
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
        user.preferences.priorities.forEach(pref => {
            const field = PREFERENCE_FIELDS.find(f => f.id === pref.field);
            if (field) {
                mismatchCounts[pref.field] = {
                    label: field.label,
                    count: 0
                };
            }
        });

        // Count mismatches for each candidate
        candidates.forEach(candidate => {
            user.preferences.priorities.forEach(pref => {
                if (!matchesPreference(candidate, pref.field, user)) {
                    mismatchCounts[pref.field].count++;
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

        document.getElementById('unlock-modal').classList.remove('active');
        document.getElementById('unlock-message').value = '';

        alert('공개 요청이 전송되었습니다. 관리자 승인 후 프로필을 확인할 수 있습니다.');
    };
}


// Matching Algorithm
// Matching Algorithm
async function findMatches(user) {
    const allUsers = await fetchUsers();
    const candidates = allUsers.filter(u =>
        u.id !== user.id && u.gender !== user.gender
    );

    const matches = candidates.map(candidate => {
        const score = calculateMatchScore(user, candidate);
        return { user: candidate, score };
    });

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches;
}

function calculateMatchScore(user, candidate) {
    if (user.preferences.priorities.length === 0) {
        return 50; // Default score if no preferences
    }

    let totalScore = 0;
    let maxPossibleScore = 0;

    user.preferences.priorities.forEach((pref, index) => {
        const weight = 10 - index; // 1st: 10 points, 2nd: 9 points, etc.
        maxPossibleScore += weight;

        if (matchesPreference(candidate, pref.field, user)) {
            totalScore += weight;
        }
    });

    return Math.round((totalScore / maxPossibleScore) * 100);
}

function matchesPreference(candidate, fieldId, user) {
    // Get the preference value from user's preferences
    const pref = user.preferences.priorities.find(p => p.field === fieldId);
    if (!pref || !pref.value) {
        return false;
    }

    const prefValue = pref.value;

    switch (fieldId) {
        case 'birthYear':
            // Check if candidate's birth year is within the range
            return candidate.birthYear >= prefValue.min && candidate.birthYear <= prefValue.max;
        case 'religion':
            return candidate.religion === prefValue;
        case 'height':
            // Check if candidate's height is within the range
            return candidate.height >= prefValue.min && candidate.height <= prefValue.max;
        case 'drinking':
            return candidate.drinking === prefValue;
        case 'hobbies':
            // At least one common hobby from preferred hobbies
            if (Array.isArray(prefValue) && prefValue.length > 0) {
                return prefValue.some(h => candidate.hobbies.includes(h));
            }
            return false;
        case 'job':
            return candidate.job === prefValue;
        case 'education':
            return candidate.education === prefValue;
        case 'location':
            return candidate.location === prefValue;
        case 'smoking':
            return candidate.smoking === prefValue;
        case 'mbti':
            return candidate.mbti.toUpperCase() === prefValue.toUpperCase();
        case 'marriagePlan':
            return candidate.marriagePlan === prefValue;
        default:
            return false;
    }
}

// Admin Functions
function showAdminLogin() {
    showPage('admin-login-page');

    const form = document.getElementById('admin-login-form');
    const errorDiv = document.getElementById('admin-error');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const password = document.getElementById('admin-password').value;
        const errorMsg = document.getElementById('admin-error');

        // Simple SHA-256 hash function for client-side
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === ADMIN_PASSWORD_HASH) {
            localStorage.setItem(STORAGE_KEYS.ADMIN_LOGGED_IN, 'true');
            showAdminDashboard();
        } else {
            errorMsg.textContent = '비밀번호가 올바르지 않습니다.';
            errorMsg.style.display = 'block';
        }
    };
}

async function showAdminDashboard() {
    showPage('admin-dashboard-page');

    // Logout button
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_LOGGED_IN);
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
                    <div class="detail-label">학력</div>
                    <div class="detail-value">${user.education || 'N/A'}</div>
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
        request.status = 'approved';
        request.reviewedAt = Date.now();
        await saveUnlockRequest(request);

        // Add to unlocked profiles
        await addUnlockedProfile(request.requesterId, request.targetId);

        alert('승인되었습니다.');
        displayUnlockRequests();
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
    }
}

// Data Management
// Data Access Functions (Firestore)

async function fetchUsers() {
    try {
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

async function saveUser(user) {
    try {
        await db.collection('users').doc(user.id).set(user);
    } catch (error) {
        console.error("Error saving user:", error);
        alert('저장 중 오류가 발생했습니다.');
    }
}

async function fetchUnlockRequests() {
    try {
        const snapshot = await db.collection('unlockRequests').get();
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error fetching requests:", error);
        return [];
    }
}

async function saveUnlockRequest(request) {
    try {
        await db.collection('unlockRequests').doc(request.id).set(request);
    } catch (error) {
        console.error("Error saving request:", error);
        alert('요청 저장 중 오류가 발생했습니다.');
    }
}

async function fetchUnlockedProfiles(userId) {
    try {
        const doc = await db.collection('unlockedProfiles').doc(userId).get();
        if (doc.exists) {
            return doc.data().unlocked || [];
        }
        return [];
    } catch (error) {
        console.error("Error fetching unlocked profiles:", error);
        return [];
    }
}

async function addUnlockedProfile(userId, targetId) {
    try {
        const docRef = db.collection('unlockedProfiles').doc(userId);
        const doc = await docRef.get();

        if (doc.exists) {
            await docRef.update({
                unlocked: firebase.firestore.FieldValue.arrayUnion(targetId)
            });
        } else {
            await docRef.set({
                unlocked: [targetId]
            });
        }
    } catch (error) {
        console.error("Error adding unlocked profile:", error);
    }
}

async function updateUserCount() {
    const userCountElement = document.getElementById('total-users-count');
    if (userCountElement) {
        const users = await fetchUsers();
        userCountElement.textContent = users.length;
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
