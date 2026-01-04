const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function generateGrowthStats() {
    try {
        console.log('Calculating growth stats...');

        // 1. Process Users
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({
            createdAt: doc.data().createdAt || doc.data().timestamp
        })).filter(u => u.createdAt);

        // 2. Process Requests
        const requestsSnapshot = await db.collection('unlock_requests').get();
        const requests = requestsSnapshot.docs.map(doc => ({
            timestamp: doc.data().timestamp
        })).filter(r => r.timestamp);

        const formatDate = (ts) => {
            const date = new Date(ts);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        };

        const dataByDate = {};

        users.forEach(u => {
            const date = formatDate(u.createdAt);
            if (!dataByDate[date]) dataByDate[date] = { users: 0, requests: 0 };
            dataByDate[date].users++;
        });

        requests.forEach(r => {
            const date = formatDate(r.timestamp);
            if (!dataByDate[date]) dataByDate[date] = { users: 0, requests: 0 };
            dataByDate[date].requests++;
        });

        const sortedDates = Object.keys(dataByDate).sort((a, b) => {
            const [m1, d1] = a.split('/').map(Number);
            const [m2, d2] = b.split('/').map(Number);
            return m1 !== m2 ? m1 - m2 : d1 - d2;
        });

        let cumulativeUsers = 0;
        let cumulativeRequests = 0;
        const trendData = sortedDates.map(date => {
            cumulativeUsers += dataByDate[date].users;
            cumulativeRequests += dataByDate[date].requests;
            return {
                date,
                cumulativeUsers,
                cumulativeRequests
            };
        });

        // 3. Save to stats collection
        await db.collection('stats').doc('growth_trend').set({
            labels: sortedDates,
            userHistory: trendData.map(d => d.cumulativeUsers),
            requestHistory: trendData.map(d => d.cumulativeRequests),
            totalUsers: usersSnapshot.size,
            totalRequests: requestsSnapshot.size,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Growth stats generated and saved to stats/growth_trend');
        process.exit(0);
    } catch (error) {
        console.error('Error generating growth stats:', error);
        process.exit(1);
    }
}

generateGrowthStats();
