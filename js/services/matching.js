// Matching service - Matching algorithm and scoring

// Helper function to get user from Firestore
async function getUser(userId) {
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}

// Find matches for a user
async function findMatches(user) {
    console.log('--- findMatches called ---');

    // Fallback to global currentUser if user argument is missing preferences
    let matchingUser = user;
    if (!matchingUser || !matchingUser.preferences || Object.keys(matchingUser.preferences).length === 0) {
        console.warn('User argument has no preferences, checking global currentUser...');
        if (window.currentUser && window.currentUser.preferences && Object.keys(window.currentUser.preferences).length > 0) {
            console.log('Using global currentUser instead');
            matchingUser = window.currentUser;
        } else {
            console.error('Global currentUser also has no preferences! Fetching from Firestore...');
            try {
                // Try to fetch fresh user data
                const freshUser = await getUser(user.id || window.currentUser.id);
                if (freshUser && freshUser.preferences && Object.keys(freshUser.preferences).length > 0) {
                    console.log('Fetched fresh user data with preferences');
                    matchingUser = freshUser;
                    // Update global currentUser
                    window.currentUser = freshUser;
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
            window.showPage('preference-page');
            window.dispatchEvent(new CustomEvent('setupPreferences'));
        }

        return []; // Stop matching process
    }

    console.log('--- User Preferences ---');
    // Use JSON.stringify for guaranteed output in all consoles
    console.log(JSON.stringify(matchingUser.preferences, null, 2));
    console.log('------------------------');

    const allUsers = await window.fetchUsers();

    // Remove duplicates by user ID first
    const uniqueUsers = Array.from(
        new Map(allUsers.map(user => [user.id, user])).values()
    );

    const candidates = uniqueUsers.filter(u =>
        u.id !== matchingUser.id && u.gender !== matchingUser.gender
    ).filter(u => {
        // Filter out test accounts for regular users
        const testAccounts = ['testA', 'testB', '테스트 A', '테스트 B'];
        const isTestUser = testAccounts.includes(matchingUser.name);

        if (!isTestUser) {
            return !testAccounts.includes(u.name);
        }
        return true; // Test users can see everyone (including other test users)
    });

    const matches = candidates.map(candidate => {
        // Calculate how well the candidate matches MY preferences
        const myScore = calculateMatchScore(matchingUser, candidate);

        // Calculate how well I match the CANDIDATE's preferences (if they have any)
        const theirScore = candidate.preferences && Object.keys(candidate.preferences).length > 0
            ? calculateMatchScore(candidate, matchingUser)
            : { percentage: 0, priorityScore: 0 };

        // Combined score: average of both directions
        const combinedPercentage = candidate.preferences && Object.keys(candidate.preferences).length > 0
            ? Math.round((myScore.percentage + theirScore.percentage) / 2)
            : myScore.percentage; // If candidate has no preferences, use only my score

        return {
            user: candidate,
            score: combinedPercentage,
            myScore: myScore.percentage,
            theirScore: theirScore.percentage,
            priorityScore: myScore.priorityScore + theirScore.priorityScore,
            hasMutualPreferences: candidate.preferences && Object.keys(candidate.preferences).length > 0
        };
    });

    // Sort by combined percentage first, then by priority score
    matches.sort((a, b) => {
        if (b.score === a.score) {
            return b.priorityScore - a.priorityScore; // Same percentage: higher priority score first
        }
        return b.score - a.score; // Different percentage: higher percentage first
    });

    // console.log('\n=== Final Match Results (Top 10) ===');
    // matches.slice(0, 10).forEach((m, i) => {
    //     console.log(`#${i + 1} ${m.user.name} | Score: ${m.score}% | Priority Score: ${m.priorityScore}`);
    //     console.log('   Candidate Info:', {
    //         birthYear: m.user.birthYear,
    //         height: m.user.height,
    //         mbti: m.user.mbti,
    //         religion: m.user.religion,
    //         drinking: m.user.drinking,
    //         smoking: m.user.smoking,
    //         hobbies: m.user.hobbies,
    //         job: m.user.job,
    //         location: m.user.location
    //     });
    // });
    // console.log('====================================\n');

    return matches;
}

// Calculate match score between user and candidate
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

    prefEntries.forEach(([fieldId, pref]) => {
        const isMatch = matchesPreference(candidate, fieldId, pref);
        if (isMatch) {
            matchedCount++;
            priorityScore += pref.priority; // Use the stored priority from the preference object
        }
    });

    const percentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
    return { percentage, priorityScore };
}

// Check if candidate matches a specific preference
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

    // Special handling for education (hierarchical matching)
    if (fieldId === 'education') {
        // Education hierarchy: 고졸 < 초대졸 < 대졸 < 대학원
        const educationLevels = {
            '고졸': 1,
            '초대졸': 2,
            '대졸': 3,
            '대학원': 4
        };

        const candLevel = educationLevels[candVal] || 0;
        const prefLevel = educationLevels[prefVal] || 0;

        // Candidate's education must be >= preferred education
        // 대졸 선호 → 대졸, 대학원 매칭
        // 초대졸 선호 → 초대졸, 대졸, 대학원 매칭
        // 고졸 선호 → 고졸만 매칭
        return candLevel >= prefLevel;
    }

    return candVal === prefVal;
}

// Analyze why there are no matches
async function analyzeMismatches(user) {
    const allUsers = await window.fetchUsers();
    const candidates = allUsers.filter(u =>
        u.id !== user.id && u.gender !== user.gender
    );

    const mismatchCounts = {};

    // Initialize mismatch counts for each preference
    Object.keys(user.preferences).forEach(fieldId => {
        const field = window.PREFERENCE_FIELDS.find(f => f.id === fieldId);
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

// Export to global scope
window.findMatches = findMatches;
window.calculateMatchScore = calculateMatchScore;
window.matchesPreference = matchesPreference;
window.analyzeMismatches = analyzeMismatches;
