const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'railway_nosql_db';

let client = null;
let db = null;
let isConnected = false;

if (uri) {
    try {
        client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000
        });

        // Initialize connection
        client.connect()
            .then(async connectedClient => {
                db = connectedClient.db(dbName);
                isConnected = true;
                console.log(`✓ Connected to MongoDB Atlas: ${dbName}`);

                // Auto-seed demo collections if empty
                try {
                    const setupMongo = require('./setup_mongodb');
                    if (typeof setupMongo.seedDatabase === 'function') {
                        await setupMongo.seedDatabase(db);
                    }
                } catch (seedErr) {
                    console.warn('[MongoDB Auto-Seed Warning]:', seedErr.message);
                }
            })
            .catch(err => {
                isConnected = false;
                console.warn(`[MongoDB Warning] Could not connect to MongoDB Atlas (${err.message}). Falling back to mock/MySQL mode.`);
            });
    } catch (initErr) {
        console.warn('[MongoDB Warning] Client init error:', initErr.message);
    }
} else {
    console.log('[MongoDB Info] No MONGODB_URI found in .env. MongoDB mode will run with fallback mock data until configured.');
}

module.exports = {
    getClient: () => client,
    getDb: () => db,
    isConnected: () => isConnected,
    dbName: dbName
};
