// UI Module - Modal Functions
// Extracted from main.js for better code organization

// Format preference value for display
function formatPreferenceValue(fieldId, pref) {
    const field = PREFERENCE_FIELDS.find(f => f.id === fieldId);
    if (!field || !pref || !pref.value) return '정보 없음';

    // Range type (나이, 키 등)
    if (typeof pref.value === 'object' && pref.value.min !== undefined) {
        if (fieldId === 'birthYear') {
            const currentYear = new Date().getFullYear();
            const maxAge = currentYear - pref.value.min + 1;
            const minAge = currentYear - pref.value.max + 1;
            return `${minAge}세 ~${maxAge} 세(${pref.value.min}년생 ~${pref.value.max}년생)`;
        }
        return `${pref.value.min} ~${pref.value.max} `;
    }

    // Multi-select (배열)
    if (Array.isArray(pref.value)) {
        return pref.value.join(', ');
    }

    // Single value
    return pref.value;
}

// Get border color based on position in list
function getPreferenceBorderColor(index, total) {
    // Gradient from pink (most important) to purple (least important)
    const colors = ['#FF6B9D', '#FF8FB3', '#C77DFF', '#9D4EDD', '#7B2CBF'];
    const colorIndex = Math.min(Math.floor((index / Math.max(total - 1, 1)) * (colors.length - 1)), colors.length - 1);
    return colors[colorIndex];
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

// Export to global scope
window.formatPreferenceValue = formatPreferenceValue;
window.getPreferenceBorderColor = getPreferenceBorderColor;
window.openImageViewer = openImageViewer;
