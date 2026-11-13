const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const mongo = require('./db_mongo');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Active sessions in-memory cache
const activeSessions = new Map();

// Helper to determine target database from headers or query parameters
function getTargetDatabase(req) {
    const headerDb = req.headers['x-database'];
    const queryDb = req.query?.database || req.query?.db;
    const bodyDb = req.body?.database;
    const raw = String(headerDb || queryDb || bodyDb || 'mysql').toLowerCase();
    return raw.includes('mongo') ? 'mongodb' : 'mysql';
}

// Helper to calculate time difference
function calculateDuration(depTime, arrTime) {
    if (!depTime || !arrTime) return '4h 00m';
    try {
        const [dh, dm] = depTime.split(':').map(Number);
        const [ah, am] = arrTime.split(':').map(Number);
        let depMinutes = dh * 60 + dm;
        let arrMinutes = ah * 60 + am;
        if (arrMinutes < depMinutes) {
            arrMinutes += 24 * 60; // Next day arrival
        }
        const diff = arrMinutes - depMinutes;
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        return `${hours}h ${mins.toString().padStart(2, '0')}m`;
    } catch {
        return '4h 30m';
    }
}

// Authentication extraction & verification helper
async function getAuthUser(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
    if (token && activeSessions.has(token)) {
        return activeSessions.get(token);
    }

    const userId = req.headers['x-user-id'] || req.query?.userId || req.body?.userId;
    const targetDb = getTargetDatabase(req);

    if (userId) {
        if (targetDb === 'mongodb' && mongo.getDb()) {
            try {
                const u = await mongo.getDb().collection('users').findOne({
                    $or: [{ user_id: parseInt(userId, 10) }, { user_id: String(userId) }]
                });
                if (u) {
                    return {
                        userId: u.user_id,
                        name: u.name,
                        email: u.email,
                        phone: u.phone,
                        role: u.role,
                        database: 'mongodb'
                    };
                }
            } catch (mErr) {
                console.error('Error verifying MongoDB user:', mErr.message);
            }
        }

        try {
            const [rows] = await db.query(
                'SELECT user_id, name, email, phone, role FROM users WHERE user_id = ?',
                [userId]
            );
            if (rows.length > 0) {
                return {
                    userId: rows[0].user_id,
                    name: rows[0].name,
                    email: rows[0].email,
                    phone: rows[0].phone,
                    role: rows[0].role,
                    database: 'mysql'
                };
            }
        } catch (err) {
            console.error('Error verifying user:', err.message);
        }
    }
    return null;
}

// Middleware: Require Authenticated User
async function requireAuth(req, res, next) {
    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({
            error: 'Authentication required. Please log in before proceeding.'
        });
    }
    req.user = user;
    next();
}

// Middleware: Require Administrator Role
async function requireAdmin(req, res, next) {
    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({
            error: 'Authentication required. Please log in as an Administrator.'
        });
    }
    if (user.role !== 'Admin') {
        return res.status(403).json({
            error: 'Access denied. Administrator privileges required.'
        });
    }
    req.user = user;
    next();
}

// -----------------------------------------------------------------------------
// PAGE ROUTING: SEPARATE PASSENGER AND ADMIN PORTALS
// -----------------------------------------------------------------------------

// Landing page route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Dedicated login / auth page route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Main dashboard router (serves dashboard.html)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Dedicated Passenger portal route
app.get('/passenger', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Dedicated Admin portal route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// -----------------------------------------------------------------------------
// AUTHENTICATION APIS (WITH 10-DIGIT MOBILE VALIDATION)
// -----------------------------------------------------------------------------

// REGISTER
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone, role } = req.body;
    const targetDb = getTargetDatabase(req);

    if (!name || !email || !password || !phone) {
        return res.status(400).json({
            error: 'All fields (Name, Email, Password, Phone) are required.'
        });
    }

    // 10-Digit Mobile Validation
    const cleanPhone = String(phone).trim().replace(/\D/g, '');
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(cleanPhone)) {
        return res.status(400).json({
            error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
        });
    }

    // Password strength check
    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters long.'
        });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            error: 'Please enter a valid email address.'
        });
    }

    // MONGODB ATLAS REGISTRATION
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const mongoDb = mongo.getDb();
            const existing = await mongoDb.collection('users').findOne({ email: email.trim().toLowerCase() });
            if (existing) {
                return res.status(409).json({
                    error: 'Email is already registered in MongoDB Atlas. Please login or use a different email.'
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const assignedRole = role === 'Admin' ? 'Admin' : 'Passenger';
            const newUserId = Date.now();

            await mongoDb.collection('users').insertOne({
                user_id: newUserId,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password: hashedPassword,
                phone: cleanPhone,
                role: assignedRole,
                database_source: 'MongoDB Atlas (NoSQL)',
                created_at: new Date()
            });

            try {
                await mongoDb.collection('system_logs').insertOne({
                    log_message: `User registered in MongoDB: ${email.trim()} (${assignedRole})`,
                    logged_at: new Date()
                });
            } catch (_) {}

            return res.status(201).json({
                message: 'Registration successful in MongoDB Atlas! You may now login.',
                userId: newUserId,
                database: 'mongodb'
            });
        } catch (mErr) {
            console.error('MongoDB Registration error:', mErr);
            return res.status(500).json({ error: 'Server error during MongoDB registration.' });
        }
    }

    // MYSQL REGISTRATION
    try {
        const [existing] = await db.query(
            'SELECT user_id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                error: 'Email is already registered. Please login or use a different email.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const assignedRole = role === 'Admin' ? 'Admin' : 'Passenger';

        const [result] = await db.query(
            `INSERT INTO users (name, email, password, phone, role)
             VALUES (?, ?, ?, ?, ?)`,
            [name.trim(), email.trim(), hashedPassword, cleanPhone, assignedRole]
        );

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `User registered: ${email.trim()} (${assignedRole})`
            ]);
        } catch (_) { }

        res.status(201).json({
            message: 'Registration successful! You may now login.',
            userId: result.insertId,
            database: 'mysql'
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            error: 'Server error during registration.'
        });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const targetDb = getTargetDatabase(req);

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required.'
        });
    }

    // MONGODB ATLAS LOGIN
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const mongoDb = mongo.getDb();
            const user = await mongoDb.collection('users').findOne({ email: email.trim().toLowerCase() });
            if (!user) {
                return res.status(401).json({
                    error: 'Invalid email or password on MongoDB Atlas.'
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({
                    error: 'Invalid email or password on MongoDB Atlas.'
                });
            }

            const token = Buffer.from(`${user.user_id}:mongo:${user.role}:${Date.now()}:${Math.random()}`).toString('base64');
            activeSessions.set(token, {
                userId: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                database: 'mongodb'
            });

            try {
                await mongoDb.collection('system_logs').insertOne({
                    log_message: `User logged in to MongoDB: ${user.email} (${user.role})`,
                    logged_at: new Date()
                });
            } catch (_) {}

            return res.status(200).json({
                message: 'Login successful to MongoDB Atlas!',
                token: token,
                database: 'mongodb',
                user: {
                    userId: user.user_id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    database: 'mongodb',
                    token: token
                }
            });
        } catch (mErr) {
            console.error('MongoDB login error:', mErr);
            return res.status(500).json({ error: 'Server error during MongoDB login.' });
        }
    }

    // MYSQL LOGIN
    try {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        // Generate session token
        const token = Buffer.from(`${user.user_id}:mysql:${user.role}:${Date.now()}:${Math.random()}`).toString('base64');
        activeSessions.set(token, {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            database: 'mysql'
        });

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `User logged in: ${user.email} (${user.role})`
            ]);
        } catch (_) { }

        res.status(200).json({
            message: 'Login successful!',
            token: token,
            database: 'mysql',
            user: {
                userId: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                database: 'mysql',
                token: token
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            error: 'Server error during login.'
        });
    }
});

// LOGOUT
app.post('/api/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
    if (token) {
        activeSessions.delete(token);
    }
    res.json({ message: 'Logged out successfully.' });
});

// CURRENT AUTHENTICATED USER SESSION
app.get('/api/auth/me', async (req, res) => {
    const user = await getAuthUser(req);
    if (!user) {
        return res.status(401).json({ authenticated: false });
    }
    res.json({ authenticated: true, user });
});

// -----------------------------------------------------------------------------
// STATIONS & TRAIN ROUTES APIS (INTERMEDIATE STOPS SUPPORT)
// -----------------------------------------------------------------------------

// GET ALL STATIONS
app.get('/api/stations', async (req, res) => {
    const targetDb = getTargetDatabase(req);

    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const mStations = await mongo.getDb().collection('stations').find({}).sort({ city: 1 }).toArray();
            if (mStations.length > 0) {
                return res.json(mStations);
            }
        } catch (mErr) {
            console.error('Error fetching MongoDB stations:', mErr.message);
        }
    }

    try {
        const [stations] = await db.query('SELECT * FROM stations ORDER BY city ASC');
        if (stations.length > 0) {
            return res.json(stations);
        }
    } catch (err) {
        console.error('Error fetching stations:', err.message);
    }

    res.json([
        { station_id: 1, station_code: 'NDLS', station_name: 'New Delhi Railway Station', city: 'New Delhi' },
        { station_id: 2, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai' },
        { station_id: 3, station_code: 'SBC', station_name: 'KSR Bengaluru City', city: 'Bengaluru' },
        { station_id: 4, station_code: 'CSTM', station_name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai' },
        { station_id: 5, station_code: 'HWH', station_name: 'Howrah Junction', city: 'Kolkata' },
        { station_id: 6, station_code: 'PDY', station_name: 'Puducherry Railway Station', city: 'Puducherry' },
        { station_id: 7, station_code: 'HYB', station_name: 'Hyderabad Deccan', city: 'Hyderabad' },
        { station_id: 8, station_code: 'ADI', station_name: 'Ahmedabad Junction', city: 'Ahmedabad' }
    ]);
});

// SEARCH TRAINS (SUPPORTS DIRECT & INTERMEDIATE ROUTES)
const handleSearchTrains = async (req, res) => {
    const { from, to, date } = req.query;
    const targetDb = getTargetDatabase(req);

    // MONGODB TRAIN SEARCH
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const allMongoTrains = await mongo.getDb().collection('trains').find({}).toArray();
            let matched = [];

            if (from && to) {
                const fLower = from.toLowerCase().trim();
                const tLower = to.toLowerCase().trim();

                for (let tr of allMongoTrains) {
                    if (Array.isArray(tr.route) && tr.route.length >= 2) {
                        const fromIdx = tr.route.findIndex(r => 
                            (r.station_code && r.station_code.toLowerCase() === fLower) ||
                            (r.city && r.city.toLowerCase().includes(fLower)) ||
                            (r.station_name && r.station_name.toLowerCase().includes(fLower))
                        );
                        const toIdx = tr.route.findIndex(r => 
                            (r.station_code && r.station_code.toLowerCase() === tLower) ||
                            (r.city && r.city.toLowerCase().includes(tLower)) ||
                            (r.station_name && r.station_name.toLowerCase().includes(tLower))
                        );

                        if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
                            const rFrom = tr.route[fromIdx];
                            const rTo = tr.route[toIdx];
                            matched.push({
                                ...tr,
                                source_code: rFrom.station_code,
                                source_name: rFrom.station_name,
                                source_city: rFrom.city,
                                dest_code: rTo.station_code,
                                dest_name: rTo.station_name,
                                dest_city: rTo.city,
                                departure_time: rFrom.departure_time,
                                arrival_time: rTo.arrival_time,
                                duration: calculateDuration(rFrom.departure_time, rTo.arrival_time),
                                segment_distance: (rTo.distance_from_source || 0) - (rFrom.distance_from_source || 0),
                                isIntermediate: (fromIdx > 0 || toIdx < tr.route.length - 1),
                                database_source: 'MongoDB Atlas (NoSQL)'
                            });
                        }
                    }
                }
            } else {
                matched = allMongoTrains.map(tr => ({
                    ...tr,
                    duration: calculateDuration(tr.route?.[0]?.departure_time, tr.route?.[tr.route?.length - 1]?.arrival_time),
                    database_source: 'MongoDB Atlas (NoSQL)'
                }));
            }

            if (matched.length > 0) {
                return res.json(matched);
            }
        } catch (mErr) {
            console.error('MongoDB Train search error:', mErr.message);
        }
    }

    try {
        let matchedTrains = [];

        if (from && to) {
            // Search via intermediate routes table
            const intermediateQuery = `
                SELECT 
                    t.train_number,
                    t.train_name,
                    t.total_coaches,
                    s_from.station_code AS source_code,
                    s_from.station_name AS source_name,
                    s_from.city AS source_city,
                    r_from.departure_time AS departure_time,
                    r_from.stop_number AS from_stop_number,
                    r_from.distance_from_source AS from_distance,
                    s_to.station_code AS dest_code,
                    s_to.station_name AS dest_name,
                    s_to.city AS dest_city,
                    r_to.arrival_time AS arrival_time,
                    r_to.stop_number AS to_stop_number,
                    r_to.distance_from_source AS to_distance,
                    (r_to.distance_from_source - r_from.distance_from_source) AS segment_distance,
                    s_orig.station_code AS terminal_orig_code,
                    s_orig.station_name AS terminal_orig_name,
                    s_dest.station_code AS terminal_dest_code,
                    s_dest.station_name AS terminal_dest_name
                FROM trains t
                JOIN routes r_from ON t.train_number = r_from.train_number
                JOIN stations s_from ON r_from.station_id = s_from.station_id
                JOIN routes r_to ON t.train_number = r_to.train_number
                JOIN stations s_to ON r_to.station_id = s_to.station_id
                JOIN stations s_orig ON t.source_station_id = s_orig.station_id
                JOIN stations s_dest ON t.destination_station_id = s_dest.station_id
                WHERE (s_from.station_code = ? OR s_from.city LIKE ?)
                  AND (s_to.station_code = ? OR s_to.city LIKE ?)
                  AND r_from.stop_number < r_to.stop_number
                ORDER BY r_from.departure_time ASC
            `;
            const [routeResults] = await db.query(intermediateQuery, [from, `%${from}%`, to, `%${to}%`]);

            if (routeResults.length > 0) {
                matchedTrains = routeResults.map(tr => ({
                    ...tr,
                    duration: calculateDuration(tr.departure_time, tr.arrival_time),
                    isIntermediate: (tr.source_code !== tr.terminal_orig_code || tr.dest_code !== tr.terminal_dest_code)
                }));
            } else {
                // Fallback to direct trains table if not found in routes table
                const directQuery = `
                    SELECT 
                        t.train_number,
                        t.train_name,
                        t.total_coaches,
                        s1.station_code AS source_code,
                        s1.station_name AS source_name,
                        s1.city AS source_city,
                        s2.station_code AS dest_code,
                        s2.station_name AS dest_name,
                        s2.city AS dest_city
                    FROM trains t
                    JOIN stations s1 ON t.source_station_id = s1.station_id
                    JOIN stations s2 ON t.destination_station_id = s2.station_id
                    WHERE (s1.station_code = ? OR s1.city LIKE ?) AND (s2.station_code = ? OR s2.city LIKE ?)
                `;
                const [directResults] = await db.query(directQuery, [from, `%${from}%`, to, `%${to}%`]);
                matchedTrains = directResults;
            }
        } else {
            // No filter: Return all trains
            const allQuery = `
                SELECT 
                    t.train_number,
                    t.train_name,
                    t.total_coaches,
                    s1.station_code AS source_code,
                    s1.station_name AS source_name,
                    s1.city AS source_city,
                    s2.station_code AS dest_code,
                    s2.station_name AS dest_name,
                    s2.city AS dest_city
                FROM trains t
                JOIN stations s1 ON t.source_station_id = s1.station_id
                JOIN stations s2 ON t.destination_station_id = s2.station_id
                ORDER BY t.train_number ASC
            `;
            const [allTrains] = await db.query(allQuery);
            matchedTrains = allTrains;
        }

        if (matchedTrains.length > 0) {
            // Attach classes and full route schedule to each train
            for (let train of matchedTrains) {
                const [classes] = await db.query(
                    'SELECT class_type, total_seats, base_fare FROM train_classes WHERE train_number = ?',
                    [train.train_number]
                );
                train.classes = classes;

                const [route] = await db.query(`
                    SELECT 
                        r.route_id,
                        r.stop_number,
                        s.station_code,
                        s.station_name,
                        s.city,
                        r.arrival_time,
                        r.departure_time,
                        r.distance_from_source
                    FROM routes r
                    JOIN stations s ON r.station_id = s.station_id
                    WHERE r.train_number = ?
                    ORDER BY r.stop_number ASC
                `, [train.train_number]);

                train.route = route;

                // If departure / arrival time missing, populate from route
                if (!train.departure_time && route.length > 0) {
                    train.departure_time = route[0].departure_time;
                    train.arrival_time = route[route.length - 1].arrival_time;
                    train.duration = calculateDuration(train.departure_time, train.arrival_time);
                }
            }
            return res.json(matchedTrains);
        }
    } catch (err) {
        console.error('Error querying trains:', err.message);
    }

    // High quality fallback trains if empty or database is offline
    const fallbackTrains = [
        {
            train_number: 20607,
            train_name: 'Vande Bharat Express',
            source_code: from || 'MAS',
            dest_code: to || 'SBC',
            source_city: from === 'NDLS' ? 'New Delhi' : 'Chennai',
            dest_city: to === 'CSTM' ? 'Mumbai' : 'Bengaluru',
            departure_time: '05:50:00',
            arrival_time: '10:20:00',
            duration: '4h 30m',
            segment_distance: 362,
            isIntermediate: false,
            classes: [
                { class_type: 'AC Chair Car (CC)', base_fare: 950, total_seats: 78 },
                { class_type: 'Executive Chair (EC)', base_fare: 1850, total_seats: 24 }
            ],
            route: [
                { stop_number: 1, station_code: from || 'MAS', station_name: 'Origin Station', arrival_time: '05:40:00', departure_time: '05:50:00', distance_from_source: 0 },
                { stop_number: 2, station_code: 'KPD', station_name: 'Katpadi Junction', arrival_time: '07:13:00', departure_time: '07:15:00', distance_from_source: 130 },
                { stop_number: 3, station_code: to || 'SBC', station_name: 'Destination Station', arrival_time: '10:20:00', departure_time: '10:30:00', distance_from_source: 362 }
            ]
        },
        {
            train_number: 12007,
            train_name: 'Shatabdi Express',
            source_code: from || 'MAS',
            dest_code: to || 'SBC',
            source_city: from === 'NDLS' ? 'New Delhi' : 'Chennai',
            dest_city: to === 'CSTM' ? 'Mumbai' : 'Bengaluru',
            departure_time: '06:00:00',
            arrival_time: '11:00:00',
            duration: '5h 00m',
            segment_distance: 362,
            isIntermediate: false,
            classes: [
                { class_type: 'AC Chair Car (CC)', base_fare: 845, total_seats: 64 },
                { class_type: 'Executive Chair (EC)', base_fare: 1610, total_seats: 18 }
            ],
            route: [
                { stop_number: 1, station_code: from || 'MAS', station_name: 'Origin Station', arrival_time: '05:45:00', departure_time: '06:00:00', distance_from_source: 0 },
                { stop_number: 2, station_code: 'KPD', station_name: 'Katpadi Junction', arrival_time: '07:38:00', departure_time: '07:40:00', distance_from_source: 130 },
                { stop_number: 3, station_code: to || 'SBC', station_name: 'Destination Station', arrival_time: '11:00:00', departure_time: '11:15:00', distance_from_source: 362 }
            ]
        },
        {
            train_number: 12615,
            train_name: 'Grand Trunk Superfast Express',
            source_code: from || 'MAS',
            dest_code: to || 'SBC',
            source_city: from === 'NDLS' ? 'New Delhi' : 'Chennai',
            dest_city: to === 'CSTM' ? 'Mumbai' : 'Bengaluru',
            departure_time: '17:40:00',
            arrival_time: '23:15:00',
            duration: '5h 35m',
            segment_distance: 362,
            isIntermediate: false,
            classes: [
                { class_type: 'Sleeper (SL)', base_fare: 285, total_seats: 120 },
                { class_type: 'AC 3 Tier (3A)', base_fare: 740, total_seats: 55 },
                { class_type: 'AC 2 Tier (2A)', base_fare: 1040, total_seats: 26 },
                { class_type: 'AC First Class (1A)', base_fare: 1720, total_seats: 10 }
            ],
            route: [
                { stop_number: 1, station_code: from || 'MAS', station_name: 'Origin Station', arrival_time: '17:25:00', departure_time: '17:40:00', distance_from_source: 0 },
                { stop_number: 2, station_code: 'JTJ', station_name: 'Jolarpettai Junction', arrival_time: '20:10:00', departure_time: '20:15:00', distance_from_source: 214 },
                { stop_number: 3, station_code: to || 'SBC', station_name: 'Destination Station', arrival_time: '23:15:00', departure_time: '23:30:00', distance_from_source: 362 }
            ]
        }
    ];

    res.json(fallbackTrains);
};
app.get('/api/trains', handleSearchTrains);
app.get('/api/trains/search', handleSearchTrains);

// GET INTERMEDIATE ROUTE SCHEDULE FOR A TRAIN
app.get('/api/trains/:trainNumber/route', async (req, res) => {
    const { trainNumber } = req.params;
    const targetDb = getTargetDatabase(req);

    // MONGODB ROUTE
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const tr = await mongo.getDb().collection('trains').findOne({
                train_number: parseInt(trainNumber, 10)
            });
            if (tr) {
                return res.json({
                    trainNumber: tr.train_number,
                    trainName: tr.train_name,
                    stops: tr.route || []
                });
            }
        } catch (mErr) {
            console.error('Error fetching MongoDB train route:', mErr.message);
        }
    }

    try {
        const [train] = await db.query('SELECT train_number, train_name FROM trains WHERE train_number = ?', [trainNumber]);
        if (train.length === 0) {
            return res.status(404).json({ error: 'Train not found.' });
        }

        const [stops] = await db.query(`
            SELECT 
                r.route_id,
                r.stop_number,
                s.station_id,
                s.station_code,
                s.station_name,
                s.city,
                r.arrival_time,
                r.departure_time,
                r.distance_from_source
            FROM routes r
            JOIN stations s ON r.station_id = s.station_id
            WHERE r.train_number = ?
            ORDER BY r.stop_number ASC
        `, [trainNumber]);

        res.json({
            trainNumber: train[0].train_number,
            trainName: train[0].train_name,
            stops: stops
        });
    } catch (err) {
        console.error('Error fetching train route:', err.message);
        res.status(500).json({ error: 'Failed to fetch train route schedule.' });
    }
});

// -----------------------------------------------------------------------------
// PNR STATUS INQUIRY
// -----------------------------------------------------------------------------

app.get('/api/pnr/:pnr', async (req, res) => {
    const { pnr } = req.params;
    const targetDb = getTargetDatabase(req);

    // MONGODB PNR LOOKUP
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const booking = await mongo.getDb().collection('bookings').findOne({ pnr_number: pnr });
            if (booking) {
                return res.json(booking);
            }
        } catch (mErr) {
            console.error('MongoDB PNR lookup error:', mErr.message);
        }
    }

    try {
        const [bookings] = await db.query(`
            SELECT 
                b.pnr_number,
                b.journey_date,
                b.total_fare,
                b.booking_status,
                t.train_number,
                t.train_name,
                s1.station_name AS source,
                s1.station_code AS source_code,
                s2.station_name AS destination,
                s2.station_code AS dest_code,
                u.name as booked_by
            FROM bookings b
            JOIN trains t ON b.train_number = t.train_number
            JOIN stations s1 ON t.source_station_id = s1.station_id
            JOIN stations s2 ON t.destination_station_id = s2.station_id
            JOIN users u ON b.user_id = u.user_id
            WHERE b.pnr_number = ?
        `, [pnr]);

        if (bookings.length > 0) {
            const booking = bookings[0];
            const [passengers] = await db.query(
                'SELECT name, age, gender, seat_number, class_type FROM passengers WHERE pnr_number = ?',
                [pnr]
            );
            booking.passengers = passengers;
            booking.chart_status = booking.booking_status === 'Confirmed' ? 'CHART PREPARED' : 'CHART NOT PREPARED';
            return res.json(booking);
        }
    } catch (err) {
        console.error('PNR lookup error:', err.message);
    }

    // Demo / fallback PNR for offline testing
    if (pnr === '8421948210' || pnr === '1234567890') {
        return res.json({
            pnr_number: pnr,
            train_number: 20607,
            train_name: 'Vande Bharat Express',
            source: 'MGR Chennai Central (MAS)',
            source_code: 'MAS',
            destination: 'KSR Bengaluru City (SBC)',
            dest_code: 'SBC',
            journey_date: '2026-11-20',
            total_fare: 950.00,
            booking_status: 'Confirmed',
            chart_status: 'CHART PREPARED',
            booked_by: 'Demo Passenger',
            passengers: [
                { name: 'Narendra Sharma', age: 28, gender: 'Male', seat_number: 'C4-18', class_type: 'AC Chair Car (CC)' }
            ]
        });
    }

    res.status(404).json({
        error: 'PNR number not found in database. Please check the 10-digit PNR and try again.'
    });
});

// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// RAZORPAY PAYMENT GATEWAY & TEST MODE APIS
// -----------------------------------------------------------------------------

// 1. Public Payment Config
app.get('/api/payment/config', (req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_railway';
    res.json({
        keyId: keyId,
        currency: 'INR',
        isRealKey: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')),
        testMode: true
    });
});

// 2. Create Razorpay Order
app.post('/api/create-razorpay-order', async (req, res) => {
    const { amount, trainNumber, classType, passengerName } = req.body;
    const fare = parseFloat(amount) || 950.00;
    const amountInPaise = Math.round(fare * 100);
    const receipt = 'rcpt_' + Date.now() + '_' + Math.floor(100 + Math.random() * 900);

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // If real Razorpay test keys are provided in .env, attempt official order creation
    if (keyId && keySecret && keyId.startsWith('rzp_')) {
        try {
            const authHeader = 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64');
            const apiRes = await fetch('https://api.razorpay.com/v1/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader
                },
                body: JSON.stringify({
                    amount: amountInPaise,
                    currency: 'INR',
                    receipt: receipt,
                    notes: {
                        trainNumber: String(trainNumber || 'N/A'),
                        classType: String(classType || 'Standard'),
                        passenger: String(passengerName || 'Passenger')
                    }
                })
            });

            if (apiRes.ok) {
                const orderData = await apiRes.json();
                return res.json({
                    ...orderData,
                    keyId: keyId,
                    isSimulated: false
                });
            }
        } catch (apiErr) {
            console.warn('Razorpay Live API call error, switching to test simulator:', apiErr.message);
        }
    }

    // High fidelity test mode order for lab demonstration
    const mockOrderId = 'order_' + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 6);
    return res.json({
        id: mockOrderId,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: 'INR',
        receipt: receipt,
        status: 'created',
        keyId: keyId || 'rzp_test_dummy_railway',
        isSimulated: true
    });
});

// 3. Verify Payment
app.post('/api/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keySecret && razorpay_order_id && razorpay_signature) {
        try {
            const expectedSignature = crypto
                .createHmac('sha256', keySecret)
                .update(razorpay_order_id + '|' + razorpay_payment_id)
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ verified: false, error: 'Invalid payment signature' });
            }
        } catch (sigErr) {
            console.error('Signature verification error:', sigErr);
        }
    }

    const payId = razorpay_payment_id || ('pay_rzp_' + Math.random().toString(36).substring(2, 10).toUpperCase());
    return res.json({
        verified: true,
        paymentId: payId,
        status: 'captured'
    });
});

// TICKET BOOKING (MANDATORY LOGIN ENFORCED)
// -----------------------------------------------------------------------------

app.post('/api/book', async (req, res) => {
    const { userId, trainNumber, journeyDate, classType, passengers, totalFare, paymentId, paymentStatus } = req.body;
    const targetDb = getTargetDatabase(req);

    // 1. Mandatory login check: userId must be provided
    if (!userId) {
        return res.status(401).json({
            error: 'Authentication required. Please log in before booking train tickets.'
        });
    }

    // MONGODB BOOKING (NoSQL DOCUMENT MODEL WITH EMBEDDED PASSENGERS)
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const mongoDb = mongo.getDb();
            const user = await mongoDb.collection('users').findOne({
                $or: [{ user_id: parseInt(userId, 10) }, { user_id: String(userId) }, { email: req.user?.email }]
            }) || { user_id: userId, name: req.user?.name || 'Passenger', email: req.user?.email || 'passenger@railway.com' };

            const train = await mongoDb.collection('trains').findOne({ train_number: parseInt(trainNumber, 10) })
                || { train_name: 'Express Train', source_name: 'Origin', dest_name: 'Destination', source_code: 'MAS', dest_code: 'SBC' };

            const pnrNumber = '8' + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 9);
            const assignedClass = classType || 'Standard';
            const classPrefix = assignedClass.substring(0, 2).trim().toUpperCase();

            const assignedPassengers = (passengers || []).map((p, idx) => ({
                name: p.name || user.name,
                age: parseInt(p.age, 10) || 25,
                gender: p.gender || 'M',
                seat_number: `${classPrefix}-${10 + idx + Math.floor(Math.random() * 30)}`,
                class_type: assignedClass
            }));

            const bookingDoc = {
                pnr_number: pnrNumber,
                user_id: user.user_id,
                user_email: user.email,
                booked_by: user.name,
                train_number: parseInt(trainNumber, 10),
                train_name: train.train_name,
                source: train.source_name || train.source_code,
                source_code: train.source_code,
                destination: train.dest_name || train.dest_code,
                dest_code: train.dest_code,
                journey_date: journeyDate,
                booking_date: new Date(),
                total_fare: parseFloat(totalFare) || 950.00,
                booking_status: 'Confirmed',
                chart_status: 'CHART PREPARED',
                payment_id: paymentId || ('pay_rzp_' + Math.random().toString(36).substring(2, 8).toUpperCase()),
                payment_status: paymentStatus || 'Paid',
                database_source: 'MongoDB Atlas (NoSQL)',
                passengers: assignedPassengers
            };

            await mongoDb.collection('bookings').insertOne(bookingDoc);

            try {
                await mongoDb.collection('system_logs').insertOne({
                    log_message: `Booking confirmed in MongoDB: PNR #${pnrNumber} by ${user.email} on Train #${trainNumber}`,
                    database_source: 'MongoDB Atlas',
                    logged_at: new Date()
                });
            } catch (_) {}

            return res.status(201).json({
                message: 'Booking confirmed successfully in MongoDB Atlas!',
                pnr: pnrNumber,
                status: 'Confirmed',
                trainNumber: trainNumber,
                trainName: train.train_name,
                totalFare: bookingDoc.total_fare,
                bookedBy: user.name,
                database: 'mongodb'
            });
        } catch (mErr) {
            console.error('MongoDB Booking error:', mErr);
            return res.status(500).json({ error: 'Failed to process MongoDB reservation: ' + mErr.message });
        }
    }

    // MYSQL BOOKING (RELATIONAL 3NF MODEL)
    try {
        // Verify user exists in database
        const [userRows] = await db.query(
            'SELECT user_id, name, email, phone, role FROM users WHERE user_id = ?',
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(401).json({
                error: 'Invalid or expired user session. Please log in to complete booking.'
            });
        }

        const bookingUser = userRows[0];

        // 2. Validate booking payload
        if (!trainNumber || !journeyDate || !passengers || !Array.isArray(passengers) || passengers.length === 0) {
            return res.status(400).json({
                error: 'Incomplete booking details. Train number, journey date, and passengers are required.'
            });
        }

        // Validate train exists
        const [trainCheck] = await db.query('SELECT train_name FROM trains WHERE train_number = ?', [trainNumber]);
        if (trainCheck.length === 0) {
            return res.status(404).json({ error: 'Selected train not found.' });
        }

        // Generate standard 10-digit random PNR starting with 8
        const pnrNumber = '8' + Math.floor(100000000 + Math.random() * 900000000).toString().substring(0, 9);

        // Insert booking record
        await db.query(`
            INSERT INTO bookings (pnr_number, user_id, train_number, journey_date, total_fare, booking_status)
            VALUES (?, ?, ?, ?, ?, 'Confirmed')
        `, [pnrNumber, bookingUser.user_id, trainNumber, journeyDate, totalFare || 950.00]);

        // Insert passenger records
        const assignedClass = classType || 'Standard';
        const classPrefix = assignedClass.substring(0, 2).trim().toUpperCase();

        for (let idx = 0; idx < passengers.length; idx++) {
            const p = passengers[idx];
            const seatNum = `${classPrefix}-${10 + idx + Math.floor(Math.random() * 30)}`;
            await db.query(`
                INSERT INTO passengers (pnr_number, name, age, gender, seat_number, class_type)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                pnrNumber,
                p.name || bookingUser.name,
                parseInt(p.age, 10) || 25,
                p.gender || 'M',
                seatNum,
                assignedClass
            ]);
        }

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `Booking confirmed: PNR #${pnrNumber} by ${bookingUser.email} on Train #${trainNumber}`
            ]);
        } catch (_) { }

        res.status(201).json({
            message: 'Booking confirmed successfully!',
            pnr: pnrNumber,
            status: 'Confirmed',
            trainNumber: trainNumber,
            trainName: trainCheck[0].train_name,
            totalFare: totalFare || 950.00,
            bookedBy: bookingUser.name,
            database: 'mysql'
        });

    } catch (err) {
        console.error('Booking error:', err);
        res.status(500).json({
            error: 'Failed to process reservation: ' + err.message
        });
    }
});

// GET USER'S BOOKINGS (PASSENGER PORTAL)
app.get('/api/user/bookings/:userId', async (req, res) => {
    const { userId } = req.params;
    const targetDb = getTargetDatabase(req);

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    // MONGODB USER BOOKINGS
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const mongoDb = mongo.getDb();
            const bookings = await mongoDb.collection('bookings').find({
                $or: [
                    { user_id: parseInt(userId, 10) },
                    { user_id: String(userId) },
                    { user_email: req.user?.email }
                ]
            }).sort({ booking_date: -1 }).toArray();

            return res.json(bookings);
        } catch (mErr) {
            console.error('MongoDB user bookings error:', mErr.message);
        }
    }

    // MYSQL USER BOOKINGS
    try {
        const [bookings] = await db.query(`
            SELECT 
                b.pnr_number,
                b.train_number,
                b.journey_date,
                b.booking_date,
                b.total_fare,
                b.booking_status,
                t.train_name,
                s1.station_name AS source_name,
                s1.station_code AS source_code,
                s2.station_name AS dest_name,
                s2.station_code AS dest_code
            FROM bookings b
            JOIN trains t ON b.train_number = t.train_number
            JOIN stations s1 ON t.source_station_id = s1.station_id
            JOIN stations s2 ON t.destination_station_id = s2.station_id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC
        `, [userId]);

        for (let b of bookings) {
            const [passengers] = await db.query(
                'SELECT name, age, gender, seat_number, class_type FROM passengers WHERE pnr_number = ?',
                [b.pnr_number]
            );
            b.passengers = passengers;
        }

        return res.json(bookings);
    } catch (err) {
        console.error('Error fetching user bookings:', err.message);
        res.status(500).json({ error: 'Failed to fetch user bookings.' });
    }
});

// CANCEL TICKET
app.post('/api/cancel-ticket', async (req, res) => {
    const { pnrNumber, userId } = req.body;
    const targetDb = getTargetDatabase(req);

    if (!pnrNumber) {
        return res.status(400).json({ error: 'PNR number is required.' });
    }

    // MONGODB CANCEL
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const mongoDb = mongo.getDb();
            const result = await mongoDb.collection('bookings').updateOne(
                { pnr_number: pnrNumber },
                { $set: { booking_status: 'Cancelled', chart_status: 'CANCELLED' } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Booking not found in MongoDB.' });
            }

            try {
                await mongoDb.collection('system_logs').insertOne({
                    log_message: `Booking PNR #${pnrNumber} cancelled in MongoDB Atlas`,
                    database_source: 'MongoDB Atlas',
                    logged_at: new Date()
                });
            } catch (_) {}

            return res.json({
                message: 'Ticket cancelled successfully in MongoDB Atlas. Refund initiated.',
                pnr: pnrNumber,
                database: 'mongodb'
            });
        } catch (mErr) {
            console.error('MongoDB cancellation error:', mErr.message);
            return res.status(500).json({ error: 'Failed to cancel MongoDB ticket.' });
        }
    }

    // MYSQL CANCEL
    try {
        const [check] = await db.query('SELECT user_id, booking_status FROM bookings WHERE pnr_number = ?', [pnrNumber]);
        if (check.length === 0) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        // Check ownership if userId provided
        if (userId) {
            const [user] = await db.query('SELECT role FROM users WHERE user_id = ?', [userId]);
            if (user.length > 0 && user[0].role !== 'Admin' && check[0].user_id != userId) {
                return res.status(403).json({ error: 'You are not authorized to cancel this booking.' });
            }
        }

        await db.query('UPDATE bookings SET booking_status = ? WHERE pnr_number = ?', ['Cancelled', pnrNumber]);

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `Booking PNR #${pnrNumber} cancelled`
            ]);
        } catch (_) { }

        res.json({
            message: 'Ticket cancelled successfully. Refund initiated to source account.',
            pnr: pnrNumber,
            database: 'mysql'
        });
    } catch (err) {
        console.error('Cancellation error:', err.message);
        res.status(500).json({ error: 'Failed to cancel ticket.' });
    }
});

// -----------------------------------------------------------------------------
// ADMIN PORTAL APIS (PROTECTED WITH requireAdmin)
// -----------------------------------------------------------------------------

// ADMIN STATS
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    const targetDb = getTargetDatabase(req);

    // MONGODB ADMIN STATS
    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const mongoDb = mongo.getDb();
            const totalUsers = await mongoDb.collection('users').countDocuments();
            const totalTrains = await mongoDb.collection('trains').countDocuments();
            const totalStations = await mongoDb.collection('stations').countDocuments();
            const totalBookings = await mongoDb.collection('bookings').countDocuments();

            const revAgg = await mongoDb.collection('bookings').aggregate([
                { $match: { booking_status: 'Confirmed' } },
                { $group: { _id: null, total: { $sum: '$total_fare' } } }
            ]).toArray();

            return res.json({
                totalUsers,
                totalTrains,
                totalStations,
                totalBookings,
                totalRevenue: parseFloat(revAgg[0]?.total || 0),
                database: 'mongodb'
            });
        } catch (mErr) {
            console.error('MongoDB Admin stats error:', mErr.message);
        }
    }

    // MYSQL ADMIN STATS
    try {
        const [users] = await db.query('SELECT COUNT(*) AS total FROM users');
        const [trains] = await db.query('SELECT COUNT(*) AS total FROM trains');
        const [stations] = await db.query('SELECT COUNT(*) AS total FROM stations');
        const [bookings] = await db.query('SELECT COUNT(*) AS total FROM bookings');
        const [revenue] = await db.query("SELECT COALESCE(SUM(total_fare), 0) AS total FROM bookings WHERE booking_status = 'Confirmed'");

        return res.json({
            totalUsers: users[0].total,
            totalTrains: trains[0].total,
            totalStations: stations[0].total,
            totalBookings: bookings[0].total,
            totalRevenue: parseFloat(revenue[0].total) || 0,
            database: 'mysql'
        });
    } catch (err) {
        console.error('Admin stats error:', err.message);
        res.status(500).json({ error: 'Failed to calculate admin stats.' });
    }
});

// ADMIN: GET ALL BOOKINGS
app.get('/api/admin/all-bookings', requireAdmin, async (req, res) => {
    const targetDb = getTargetDatabase(req);

    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const bookings = await mongo.getDb().collection('bookings').find({}).sort({ booking_date: -1 }).limit(100).toArray();
            return res.json(bookings);
        } catch (mErr) {
            console.error('MongoDB all bookings error:', mErr.message);
        }
    }

    try {
        const [bookings] = await db.query(`
            SELECT 
                b.pnr_number,
                b.train_number,
                b.journey_date,
                b.booking_date,
                b.total_fare,
                b.booking_status,
                t.train_name,
                u.name AS booked_by,
                u.email AS user_email
            FROM bookings b
            JOIN trains t ON b.train_number = t.train_number
            JOIN users u ON b.user_id = u.user_id
            ORDER BY b.booking_date DESC
            LIMIT 100
        `);
        return res.json(bookings);
    } catch (err) {
        console.error('Admin all bookings error:', err.message);
        res.status(500).json({ error: 'Failed to retrieve all bookings.' });
    }
});

// ADMIN: GET ALL USERS
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    const targetDb = getTargetDatabase(req);

    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const users = await mongo.getDb().collection('users').find({}, { projection: { password: 0 } }).sort({ created_at: -1 }).toArray();
            return res.json(users);
        } catch (mErr) {
            console.error('MongoDB admin users error:', mErr.message);
        }
    }

    try {
        const [users] = await db.query('SELECT user_id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) {
        console.error('Admin users error:', err.message);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// ADMIN: GET SYSTEM AUDIT LOGS
app.get('/api/admin/logs', requireAdmin, async (req, res) => {
    const targetDb = getTargetDatabase(req);

    if (targetDb === 'mongodb' && mongo.getDb()) {
        try {
            const logs = await mongo.getDb().collection('system_logs').find({}).sort({ logged_at: -1 }).limit(50).toArray();
            return res.json(logs);
        } catch (mErr) {
            console.error('MongoDB admin logs error:', mErr.message);
        }
    }

    try {
        const [logs] = await db.query('SELECT * FROM system_logs ORDER BY logged_at DESC LIMIT 50');
        return res.json(logs);
    } catch (err) {
        console.error('Admin logs error:', err.message);
        res.status(500).json({ error: 'Failed to retrieve system logs.' });
    }
});

// ADMIN: ADD NEW TRAIN
app.post('/api/admin/trains', requireAdmin, async (req, res) => {
    const { trainNumber, trainName, sourceStationId, destStationId, totalCoaches, classes } = req.body;

    if (!trainNumber || !trainName || !sourceStationId || !destStationId) {
        return res.status(400).json({ error: 'Train number, name, source station, and destination station are required.' });
    }

    try {
        await db.query(`
            INSERT INTO trains (train_number, train_name, source_station_id, destination_station_id, total_coaches)
            VALUES (?, ?, ?, ?, ?)
        `, [trainNumber, trainName.trim(), sourceStationId, destStationId, totalCoaches || 18]);

        // Automatically initialize terminal route stops in routes table
        await db.query(`
            INSERT INTO routes (train_number, station_id, stop_number, arrival_time, departure_time, distance_from_source)
            VALUES 
                (?, ?, 1, '06:00:00', '06:00:00', 0),
                (?, ?, 2, '12:00:00', '12:00:00', 350)
        `, [trainNumber, sourceStationId, trainNumber, destStationId]);

        // Add standard classes if provided or default
        const trainClasses = Array.isArray(classes) && classes.length > 0 ? classes : [
            { class_type: 'AC Chair Car (CC)', total_seats: 250, base_fare: 750 },
            { class_type: 'Sleeper (SL)', total_seats: 400, base_fare: 420 }
        ];

        for (const c of trainClasses) {
            await db.query(`
                INSERT INTO train_classes (train_number, class_type, total_seats, base_fare)
                VALUES (?, ?, ?, ?)
            `, [trainNumber, c.class_type, c.total_seats || 200, c.base_fare || 500]);
        }

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `New train created: #${trainNumber} - ${trainName.trim()}`
            ]);
        } catch (_) { }

        res.status(201).json({ message: 'Train and routes added successfully!' });
    } catch (err) {
        console.error('Add train error:', err.message);
        res.status(500).json({ error: 'Failed to add train: ' + err.message });
    }
});

// ADMIN: EDIT TRAIN
app.put('/api/admin/trains/:trainNumber', requireAdmin, async (req, res) => {
    const { trainNumber } = req.params;
    const { trainName, sourceStationId, destStationId, totalCoaches } = req.body;

    if (!trainName || !sourceStationId || !destStationId) {
        return res.status(400).json({ error: 'Train name, source station, and destination station are required.' });
    }

    try {
        await db.query(`
            UPDATE trains 
            SET train_name = ?, source_station_id = ?, destination_station_id = ?, total_coaches = ?
            WHERE train_number = ?
        `, [trainName.trim(), sourceStationId, destStationId, totalCoaches || 18, trainNumber]);

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `Train updated: #${trainNumber} - ${trainName.trim()}`
            ]);
        } catch (_) { }

        res.json({ message: 'Train updated successfully!' });
    } catch (err) {
        console.error('Update train error:', err.message);
        res.status(500).json({ error: 'Failed to update train: ' + err.message });
    }
});

// ADMIN: DELETE TRAIN
app.delete('/api/admin/trains/:trainNumber', requireAdmin, async (req, res) => {
    const { trainNumber } = req.params;

    try {
        await db.query('DELETE FROM trains WHERE train_number = ?', [trainNumber]);

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `Train deleted: #${trainNumber}`
            ]);
        } catch (_) { }

        res.json({ message: 'Train deleted successfully!' });
    } catch (err) {
        console.error('Delete train error:', err.message);
        res.status(500).json({ error: 'Failed to delete train: ' + err.message });
    }
});

// ADMIN: GET INTERMEDIATE STOPS FOR A TRAIN
app.get('/api/admin/trains/:trainNumber/routes', requireAdmin, async (req, res) => {
    const { trainNumber } = req.params;
    try {
        const [stops] = await db.query(`
            SELECT 
                r.route_id,
                r.stop_number,
                s.station_id,
                s.station_code,
                s.station_name,
                s.city,
                r.arrival_time,
                r.departure_time,
                r.distance_from_source
            FROM routes r
            JOIN stations s ON r.station_id = s.station_id
            WHERE r.train_number = ?
            ORDER BY r.stop_number ASC
        `, [trainNumber]);
        res.json(stops);
    } catch (err) {
        console.error('Error fetching admin train stops:', err.message);
        res.status(500).json({ error: 'Failed to fetch train stops.' });
    }
});

// ADMIN: ADD INTERMEDIATE STOP TO A TRAIN ROUTE
app.post('/api/admin/trains/:trainNumber/routes', requireAdmin, async (req, res) => {
    const { trainNumber } = req.params;
    const { stationId, stopNumber, arrivalTime, departureTime, distanceFromSource } = req.body;

    if (!stationId || !stopNumber) {
        return res.status(400).json({ error: 'Station and stop number are required.' });
    }

    try {
        await db.query(`
            INSERT INTO routes (train_number, station_id, stop_number, arrival_time, departure_time, distance_from_source)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            trainNumber,
            stationId,
            stopNumber,
            arrivalTime || '08:00:00',
            departureTime || '08:05:00',
            distanceFromSource || 100
        ]);

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `Stop added to Train #${trainNumber} at station #${stationId} (Stop #${stopNumber})`
            ]);
        } catch (_) { }

        res.status(201).json({ message: 'Intermediate stop added successfully!' });
    } catch (err) {
        console.error('Error adding intermediate route stop:', err.message);
        res.status(500).json({ error: 'Failed to add intermediate stop: ' + err.message });
    }
});

// ADMIN: MODIFY INTERMEDIATE ROUTE TIMINGS & DISTANCE
app.put('/api/admin/routes/:routeId', requireAdmin, async (req, res) => {
    const { routeId } = req.params;
    const { arrivalTime, departureTime, stopNumber, distanceFromSource } = req.body;

    try {
        await db.query(`
            UPDATE routes 
            SET arrival_time = ?, departure_time = ?, stop_number = ?, distance_from_source = ?
            WHERE route_id = ?
        `, [arrivalTime, departureTime, stopNumber, distanceFromSource, routeId]);

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `Route stop #${routeId} timing modified`
            ]);
        } catch (_) { }

        res.json({ message: 'Route stop timing modified successfully!' });
    } catch (err) {
        console.error('Error updating route timing:', err.message);
        res.status(500).json({ error: 'Failed to update route timing: ' + err.message });
    }
});

// ADMIN: DELETE INTERMEDIATE STOP
app.delete('/api/admin/routes/:routeId', requireAdmin, async (req, res) => {
    const { routeId } = req.params;

    try {
        await db.query('DELETE FROM routes WHERE route_id = ?', [routeId]);

        try {
            await db.query('INSERT INTO system_logs (log_message) VALUES (?)', [
                `Route stop #${routeId} removed`
            ]);
        } catch (_) { }

        res.json({ message: 'Route stop removed successfully!' });
    } catch (err) {
        console.error('Error removing route stop:', err.message);
        res.status(500).json({ error: 'Failed to remove route stop: ' + err.message });
    }
});

// -----------------------------------------------------------------------------
// DATABASE HEALTH CHECK
// -----------------------------------------------------------------------------

const handleDbStatus = async (req, res) => {
    const targetDb = getTargetDatabase(req);
    let mysqlConnected = false;
    let mongoConnected = mongo.isConnected();
    let mysqlDbName = 'railway_db';
    let mongoDbName = mongo.dbName;

    try {
        const [rows] = await db.query('SELECT DATABASE() as db_name, 1 as status');
        mysqlConnected = true;
        mysqlDbName = rows[0]?.db_name || 'railway_db';
    } catch (_) {}

    const isCurrentActiveConnected = targetDb === 'mongodb' ? mongoConnected : mysqlConnected;

    res.status(200).json({
        activeDatabase: targetDb,
        status: isCurrentActiveConnected ? 'connected' : 'fallback',
        database: targetDb === 'mongodb' ? mongoDbName : mysqlDbName,
        message: isCurrentActiveConnected ? `Connected to ${targetDb.toUpperCase()} successfully!` : `Operating with standby catalog for ${targetDb.toUpperCase()}`,
        mysql: {
            status: mysqlConnected ? 'connected' : 'standby',
            database: mysqlDbName,
            type: 'Relational (3NF)'
        },
        mongodb: {
            status: mongoConnected ? 'connected' : 'standby',
            database: mongoDbName,
            type: 'NoSQL Document Store (Atlas)'
        }
    });
};
app.get('/api/db-status', handleDbStatus);
app.get('/api/health', handleDbStatus);

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------

const PORT = process.env.PORT || 5000;

let server;
if (require.main === module || process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);
        try {
            const [result] = await db.query('SELECT DATABASE() as current_db');
            console.log(`Connected to MySQL database: ${result[0].current_db || 'railway_db'}`);
        } catch (err) {
            console.error('Database connection error on startup:', err.message);
        }
    });
    server.on('error', (err) => {
        console.error('Server HTTP listen error:', err);
    });
}

module.exports = { app, server };
