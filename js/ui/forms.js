// UI Module - Form Handling Functions
// Extracted from main.js for better code organization

// Populate edit profile form with current user data
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
    document.getElementById('edit-education').value = currentUser.education || '';

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

// Setup photo upload for edit profile form
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
                        preview.innerHTML = `<img src="${compressedDataUrl}" alt="Photo ${index + 1}" />`;
                        preview.classList.add('active');
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

// Handle edit profile form submission
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
    currentUser.education = document.getElementById('edit-education').value;
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

// Export to global scope
window.populateEditProfileForm = populateEditProfileForm;
window.setupEditPhotoUpload = setupEditPhotoUpload;
window.handleEditProfileSubmit = handleEditProfileSubmit;
