// Drag and Drop functionality for priority list

// Global variables
let draggedElement = null;
let touchStartY = 0;
let touchCurrentY = 0;
let touchElement = null;

// Setup drag and drop event listeners
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

// Desktop drag handlers
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
    if (window.updatePriorityNumbers) {
        window.updatePriorityNumbers();
    }
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
        if (window.updatePriorityNumbers) {
            window.updatePriorityNumbers();
        }
    }

    touchElement = null;
    draggedElement = null;
    touchStartY = 0;
    touchCurrentY = 0;
}

// Export to global scope
window.setupDragAndDrop = setupDragAndDrop;
window.draggedElement = draggedElement;
