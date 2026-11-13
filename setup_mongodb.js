const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'railway_nosql_db';

if (!uri) {
    console.error("Error: MONGODB_URI is not defined in your .env file.");
    console.error("Please add your MongoDB Atlas connection string in .env: MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/?retryWrites=true&w=majority");
    process.exit(1);
}

async function setupMongo() {
    console.log("Connecting to MongoDB Atlas to initialize NoSQL schema and seed data...");
    const client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    try {
        await client.connect();
        const db = client.db(dbName);
        console.log(`✓ Connected to database: '${dbName}'`);

        // Collections
        const usersCol = db.collection('users');
        const stationsCol = db.collection('stations');
        const trainsCol = db.collection('trains');
        const bookingsCol = db.collection('bookings');
        const logsCol = db.collection('system_logs');

        // Indexes
        await usersCol.createIndex({ email: 1 }, { unique: true });
        await stationsCol.createIndex({ station_code: 1 }, { unique: true });
        await trainsCol.createIndex({ train_number: 1 }, { unique: true });
        await bookingsCol.createIndex({ pnr_number: 1 }, { unique: true });
        await bookingsCol.createIndex({ user_id: 1 });
        console.log("✓ Unique indexes verified");

        // 1. Seed Demo Accounts
        const hashedPassengerPass = await bcrypt.hash('password123', 10);
        const hashedAdminPass = await bcrypt.hash('admin123', 10);

        await usersCol.deleteMany({});
        await usersCol.insertMany([
            {
                user_id: 1,
                name: 'P. Karthikeyan',
                email: 'passenger@railway.com',
                password: hashedPassengerPass,
                phone: '9876543210',
                role: 'Passenger',
                database_source: 'MongoDB Atlas (NoSQL)',
                created_at: new Date()
            },
            {
                user_id: 2,
                name: 'Railway System Administrator',
                email: 'admin@railway.com',
                password: hashedAdminPass,
                phone: '9876543211',
                role: 'Admin',
                database_source: 'MongoDB Atlas (NoSQL)',
                created_at: new Date()
            }
        ]);
        console.log("✓ Demo Users seeded (passenger@railway.com / password123 & admin@railway.com / admin123)");

        // 2. Seed Stations
        await stationsCol.deleteMany({});
        await stationsCol.insertMany([
            { station_id: 1, station_code: 'NDLS', station_name: 'New Delhi Railway Station', city: 'New Delhi' },
            { station_id: 2, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai' },
            { station_id: 3, station_code: 'SBC', station_name: 'KSR Bengaluru City', city: 'Bengaluru' },
            { station_id: 4, station_code: 'CSTM', station_name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai' },
            { station_id: 5, station_code: 'HWH', station_name: 'Howrah Junction', city: 'Kolkata' },
            { station_id: 6, station_code: 'PDY', station_name: 'Puducherry Railway Station', city: 'Puducherry' },
            { station_id: 7, station_code: 'HYB', station_name: 'Hyderabad Deccan', city: 'Hyderabad' },
            { station_id: 8, station_code: 'ADI', station_name: 'Ahmedabad Junction', city: 'Ahmedabad' },
            { station_id: 9, station_code: 'KPD', station_name: 'Katpadi Junction', city: 'Katpadi' },
            { station_id: 10, station_code: 'JTJ', station_name: 'Jolarpettai Junction', city: 'Jolarpettai' },
            { station_id: 11, station_code: 'BZA', station_name: 'Vijayawada Junction', city: 'Vijayawada' },
            { station_id: 12, station_code: 'NGP', station_name: 'Nagpur Junction', city: 'Nagpur' },
            { station_id: 13, station_code: 'AGC', station_name: 'Agra Cantt', city: 'Agra' },
            { station_id: 14, station_code: 'BRC', station_name: 'Vadodara Junction', city: 'Vadodara' },
            { station_id: 15, station_code: 'ST', station_name: 'Surat', city: 'Surat' },
            { station_id: 16, station_code: 'VM', station_name: 'Villupuram Junction', city: 'Villupuram' },
            { station_id: 17, station_code: 'WL', station_name: 'Warangal', city: 'Warangal' }
        ]);
        console.log("✓ Stations seeded");

        // 3. Seed Trains with Embedded Classes and Embedded Timetable Routes (NoSQL Document Schema)
        await trainsCol.deleteMany({});
        await trainsCol.insertMany([
            {
                train_number: 20607,
                train_name: 'Vande Bharat Express',
                source_code: 'MAS',
                source_name: 'Chennai Central',
                source_city: 'Chennai',
                dest_code: 'SBC',
                dest_name: 'KSR Bengaluru City',
                dest_city: 'Bengaluru',
                total_coaches: 16,
                classes: [
                    { class_type: 'Executive Chair (EC)', total_seats: 52, base_fare: 1850 },
                    { class_type: 'AC Chair Car (CC)', total_seats: 450, base_fare: 950 }
                ],
                route: [
                    { stop_number: 1, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai', arrival_time: '05:50:00', departure_time: '05:50:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'KPD', station_name: 'Katpadi Junction', city: 'Katpadi', arrival_time: '07:13:00', departure_time: '07:15:00', distance_from_source: 130 },
                    { stop_number: 3, station_code: 'JTJ', station_name: 'Jolarpettai Junction', city: 'Jolarpettai', arrival_time: '08:23:00', departure_time: '08:25:00', distance_from_source: 214 },
                    { stop_number: 4, station_code: 'SBC', station_name: 'KSR Bengaluru City', city: 'Bengaluru', arrival_time: '10:20:00', departure_time: '10:20:00', distance_from_source: 362 }
                ]
            },
            {
                train_number: 12007,
                train_name: 'Shatabdi Express',
                source_code: 'MAS',
                source_name: 'Chennai Central',
                source_city: 'Chennai',
                dest_code: 'SBC',
                dest_name: 'KSR Bengaluru City',
                dest_city: 'Bengaluru',
                total_coaches: 18,
                classes: [
                    { class_type: 'AC Chair Car (CC)', total_seats: 380, base_fare: 890 },
                    { class_type: 'Executive Chair (EC)', total_seats: 36, base_fare: 1610 }
                ],
                route: [
                    { stop_number: 1, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai', arrival_time: '06:00:00', departure_time: '06:00:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'KPD', station_name: 'Katpadi Junction', city: 'Katpadi', arrival_time: '07:38:00', departure_time: '07:40:00', distance_from_source: 130 },
                    { stop_number: 3, station_code: 'JTJ', station_name: 'Jolarpettai Junction', city: 'Jolarpettai', arrival_time: '08:48:00', departure_time: '08:50:00', distance_from_source: 214 },
                    { stop_number: 4, station_code: 'SBC', station_name: 'KSR Bengaluru City', city: 'Bengaluru', arrival_time: '11:00:00', departure_time: '11:00:00', distance_from_source: 362 }
                ]
            },
            {
                train_number: 12952,
                train_name: 'Mumbai Rajdhani Express',
                source_code: 'NDLS',
                source_name: 'New Delhi Railway Station',
                source_city: 'New Delhi',
                dest_code: 'CSTM',
                dest_name: 'Chhatrapati Shivaji Maharaj Terminus',
                dest_city: 'Mumbai',
                total_coaches: 22,
                classes: [
                    { class_type: 'First AC (1A)', total_seats: 24, base_fare: 3850 },
                    { class_type: '2 Tier AC (2A)', total_seats: 120, base_fare: 2450 },
                    { class_type: '3 Tier AC (3A)', total_seats: 320, base_fare: 1680 }
                ],
                route: [
                    { stop_number: 1, station_code: 'NDLS', station_name: 'New Delhi Railway Station', city: 'New Delhi', arrival_time: '16:55:00', departure_time: '16:55:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'AGC', station_name: 'Agra Cantt', city: 'Agra', arrival_time: '18:50:00', departure_time: '18:55:00', distance_from_source: 195 },
                    { stop_number: 3, station_code: 'BRC', station_name: 'Vadodara Junction', city: 'Vadodara', arrival_time: '03:20:00', departure_time: '03:30:00', distance_from_source: 992 },
                    { stop_number: 4, station_code: 'ST', station_name: 'Surat', city: 'Surat', arrival_time: '05:10:00', departure_time: '05:15:00', distance_from_source: 1122 },
                    { stop_number: 5, station_code: 'CSTM', station_name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai', arrival_time: '08:35:00', departure_time: '08:35:00', distance_from_source: 1384 }
                ]
            },
            {
                train_number: 12615,
                train_name: 'Grand Trunk Express',
                source_code: 'MAS',
                source_name: 'Chennai Central',
                source_city: 'Chennai',
                dest_code: 'NDLS',
                dest_name: 'New Delhi Railway Station',
                dest_city: 'New Delhi',
                total_coaches: 24,
                classes: [
                    { class_type: 'Sleeper (SL)', total_seats: 500, base_fare: 680 },
                    { class_type: '3 Tier AC (3A)', total_seats: 240, base_fare: 1650 },
                    { class_type: '2 Tier AC (2A)', total_seats: 90, base_fare: 2350 }
                ],
                route: [
                    { stop_number: 1, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai', arrival_time: '18:50:00', departure_time: '18:50:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'BZA', station_name: 'Vijayawada Junction', city: 'Vijayawada', arrival_time: '01:10:00', departure_time: '01:20:00', distance_from_source: 431 },
                    { stop_number: 3, station_code: 'WL', station_name: 'Warangal', city: 'Warangal', arrival_time: '04:15:00', departure_time: '04:20:00', distance_from_source: 638 },
                    { stop_number: 4, station_code: 'NGP', station_name: 'Nagpur Junction', city: 'Nagpur', arrival_time: '11:30:00', departure_time: '11:40:00', distance_from_source: 1088 },
                    { stop_number: 5, station_code: 'AGC', station_name: 'Agra Cantt', city: 'Agra', arrival_time: '03:40:00', departure_time: '03:45:00', distance_from_source: 1989 },
                    { stop_number: 6, station_code: 'NDLS', station_name: 'New Delhi Railway Station', city: 'New Delhi', arrival_time: '06:35:00', departure_time: '06:35:00', distance_from_source: 2184 }
                ]
            },
            {
                train_number: 16116,
                train_name: 'Auroville Intercity Express',
                source_code: 'PDY',
                source_name: 'Puducherry Railway Station',
                source_city: 'Puducherry',
                dest_code: 'MAS',
                dest_name: 'Chennai Central',
                dest_city: 'Chennai',
                total_coaches: 14,
                classes: [
                    { class_type: 'Second Sitting (2S)', total_seats: 320, base_fare: 120 },
                    { class_type: 'AC Chair Car (CC)', total_seats: 120, base_fare: 480 }
                ],
                route: [
                    { stop_number: 1, station_code: 'PDY', station_name: 'Puducherry Railway Station', city: 'Puducherry', arrival_time: '05:30:00', departure_time: '05:30:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'VM', station_name: 'Villupuram Junction', city: 'Villupuram', arrival_time: '06:15:00', departure_time: '06:20:00', distance_from_source: 38 },
                    { stop_number: 3, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai', arrival_time: '09:15:00', departure_time: '09:15:00', distance_from_source: 196 }
                ]
            }
        ]);
        console.log("✓ Sample Trains seeded with embedded NoSQL documents");

        // 4. Seed Sample Bookings for Presentation
        await bookingsCol.deleteMany({});
        await bookingsCol.insertMany([
            {
                pnr_number: '8421948210',
                user_id: 1,
                user_email: 'passenger@railway.com',
                booked_by: 'P. Karthikeyan',
                train_number: 20607,
                train_name: 'Vande Bharat Express',
                source: 'Chennai Central (MAS)',
                source_code: 'MAS',
                destination: 'KSR Bengaluru City (SBC)',
                dest_code: 'SBC',
                journey_date: '2026-11-20',
                booking_date: new Date(),
                total_fare: 950.00,
                booking_status: 'Confirmed',
                chart_status: 'CHART PREPARED',
                payment_id: 'pay_rzp_MONGO_DEMO_01',
                payment_status: 'Paid',
                database_source: 'MongoDB Atlas (NoSQL)',
                passengers: [
                    {
                        name: 'P. Karthikeyan',
                        age: 21,
                        gender: 'Male',
                        seat_number: 'CC-14',
                        class_type: 'AC Chair Car (CC)'
                    }
                ]
            },
            {
                pnr_number: '9102837465',
                user_id: 1,
                user_email: 'passenger@railway.com',
                booked_by: 'P. Karthikeyan',
                train_number: 12007,
                train_name: 'Shatabdi Express',
                source: 'Chennai Central (MAS)',
                source_code: 'MAS',
                destination: 'Katpadi Junction (KPD)',
                dest_code: 'KPD',
                journey_date: '2026-11-25',
                booking_date: new Date(),
                total_fare: 1780.00,
                booking_status: 'Confirmed',
                chart_status: 'CHART NOT PREPARED',
                payment_id: 'pay_rzp_MONGO_DEMO_02',
                payment_status: 'Paid',
                database_source: 'MongoDB Atlas (NoSQL)',
                passengers: [
                    {
                        name: 'P. Karthikeyan',
                        age: 21,
                        gender: 'Male',
                        seat_number: 'CC-08',
                        class_type: 'AC Chair Car (CC)'
                    },
                    {
                        name: 'M. Vathana',
                        age: 20,
                        gender: 'Female',
                        seat_number: 'CC-09',
                        class_type: 'AC Chair Car (CC)'
                    }
                ]
            }
        ]);
        console.log("✓ Sample Bookings seeded for passenger@railway.com");

        // 5. Seed System Logs
        await logsCol.deleteMany({});
        await logsCol.insertMany([
            {
                log_message: 'MongoDB NoSQL schema initialized and seeded successfully',
                database_source: 'MongoDB Atlas',
                logged_at: new Date()
            },
            {
                log_message: 'Demo users created: passenger@railway.com and admin@railway.com',
                database_source: 'MongoDB Atlas',
                logged_at: new Date()
            },
            {
                log_message: 'Demo booking confirmed: PNR #8421948210 on Train #20607',
                database_source: 'MongoDB Atlas',
                logged_at: new Date()
            }
        ]);
        console.log("✓ System audit logs seeded");

        console.log("\n========================================================");
        console.log("MongoDB Atlas Database Initialization Complete!");
        console.log("Demo Credentials:");
        console.log("  Passenger: passenger@railway.com | password123");
        console.log("  Admin:     admin@railway.com     | admin123");
        console.log("========================================================\n");
        if (require.main === module) {
            await client.close();
            process.exit(0);
        }
    } catch (err) {
        console.error("MongoDB setup error:", err.message);
        if (require.main === module) {
            process.exit(1);
        }
    }
}

async function seedDatabase(db) {
    console.log("Seeding MongoDB collections with demo data...");
    const usersCol = db.collection('users');
    const stationsCol = db.collection('stations');
    const trainsCol = db.collection('trains');
    const bookingsCol = db.collection('bookings');
    const logsCol = db.collection('system_logs');

    await usersCol.createIndex({ email: 1 }, { unique: true });
    await stationsCol.createIndex({ station_code: 1 }, { unique: true });
    await trainsCol.createIndex({ train_number: 1 }, { unique: true });
    await bookingsCol.createIndex({ pnr_number: 1 }, { unique: true });
    await bookingsCol.createIndex({ user_id: 1 });

    const hashedPassengerPass = await bcrypt.hash('password123', 10);
    const hashedAdminPass = await bcrypt.hash('admin123', 10);

    const count = await usersCol.countDocuments();
    if (count === 0) {
        await usersCol.insertMany([
            {
                user_id: 1,
                name: 'P. Karthikeyan',
                email: 'passenger@railway.com',
                password: hashedPassengerPass,
                phone: '9876543210',
                role: 'Passenger',
                database_source: 'MongoDB Atlas (NoSQL)',
                created_at: new Date()
            },
            {
                user_id: 2,
                name: 'Railway System Administrator',
                email: 'admin@railway.com',
                password: hashedAdminPass,
                phone: '9876543211',
                role: 'Admin',
                database_source: 'MongoDB Atlas (NoSQL)',
                created_at: new Date()
            }
        ]);
    }

    const stationCount = await stationsCol.countDocuments();
    if (stationCount === 0) {
        await stationsCol.insertMany([
            { station_id: 1, station_code: 'NDLS', station_name: 'New Delhi Railway Station', city: 'New Delhi' },
            { station_id: 2, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai' },
            { station_id: 3, station_code: 'SBC', station_name: 'KSR Bengaluru City', city: 'Bengaluru' },
            { station_id: 4, station_code: 'CSTM', station_name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai' },
            { station_id: 5, station_code: 'HWH', station_name: 'Howrah Junction', city: 'Kolkata' },
            { station_id: 6, station_code: 'PDY', station_name: 'Puducherry Railway Station', city: 'Puducherry' },
            { station_id: 7, station_code: 'HYB', station_name: 'Hyderabad Deccan', city: 'Hyderabad' },
            { station_id: 8, station_code: 'ADI', station_name: 'Ahmedabad Junction', city: 'Ahmedabad' },
            { station_id: 9, station_code: 'KPD', station_name: 'Katpadi Junction', city: 'Katpadi' },
            { station_id: 10, station_code: 'JTJ', station_name: 'Jolarpettai Junction', city: 'Jolarpettai' },
            { station_id: 11, station_code: 'BZA', station_name: 'Vijayawada Junction', city: 'Vijayawada' },
            { station_id: 12, station_code: 'NGP', station_name: 'Nagpur Junction', city: 'Nagpur' },
            { station_id: 13, station_code: 'AGC', station_name: 'Agra Cantt', city: 'Agra' },
            { station_id: 14, station_code: 'BRC', station_name: 'Vadodara Junction', city: 'Vadodara' },
            { station_id: 15, station_code: 'ST', station_name: 'Surat', city: 'Surat' },
            { station_id: 16, station_code: 'VM', station_name: 'Villupuram Junction', city: 'Villupuram' },
            { station_id: 17, station_code: 'WL', station_name: 'Warangal', city: 'Warangal' }
        ]);
    }

    const trainCount = await trainsCol.countDocuments();
    if (trainCount === 0) {
        await trainsCol.insertMany([
            {
                train_number: 20607,
                train_name: 'Vande Bharat Express',
                source_code: 'MAS',
                source_name: 'Chennai Central',
                source_city: 'Chennai',
                dest_code: 'SBC',
                dest_name: 'KSR Bengaluru City',
                dest_city: 'Bengaluru',
                total_coaches: 16,
                classes: [
                    { class_type: 'Executive Chair (EC)', total_seats: 52, base_fare: 1850 },
                    { class_type: 'AC Chair Car (CC)', total_seats: 450, base_fare: 950 }
                ],
                route: [
                    { stop_number: 1, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai', arrival_time: '05:50:00', departure_time: '05:50:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'KPD', station_name: 'Katpadi Junction', city: 'Katpadi', arrival_time: '07:13:00', departure_time: '07:15:00', distance_from_source: 130 },
                    { stop_number: 3, station_code: 'JTJ', station_name: 'Jolarpettai Junction', city: 'Jolarpettai', arrival_time: '08:23:00', departure_time: '08:25:00', distance_from_source: 214 },
                    { stop_number: 4, station_code: 'SBC', station_name: 'KSR Bengaluru City', city: 'Bengaluru', arrival_time: '10:20:00', departure_time: '10:20:00', distance_from_source: 362 }
                ]
            },
            {
                train_number: 12621,
                train_name: 'Tamil Nadu Superfast Express',
                source_code: 'MAS',
                source_name: 'Chennai Central',
                source_city: 'Chennai',
                dest_code: 'NDLS',
                dest_name: 'New Delhi Railway Station',
                dest_city: 'New Delhi',
                total_coaches: 24,
                classes: [
                    { class_type: 'AC 1st Class (1A)', total_seats: 24, base_fare: 3850 },
                    { class_type: 'AC 2 Tier (2A)', total_seats: 96, base_fare: 2320 },
                    { class_type: 'AC 3 Tier (3A)', total_seats: 384, base_fare: 1610 },
                    { class_type: 'Sleeper Class (SL)', total_seats: 540, base_fare: 620 }
                ],
                route: [
                    { stop_number: 1, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai', arrival_time: '22:00:00', departure_time: '22:00:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'BZA', station_name: 'Vijayawada Junction', city: 'Vijayawada', arrival_time: '03:55:00', departure_time: '04:05:00', distance_from_source: 431 },
                    { stop_number: 3, station_code: 'WL', station_name: 'Warangal', city: 'Warangal', arrival_time: '06:58:00', departure_time: '07:00:00', distance_from_source: 638 },
                    { stop_number: 4, station_code: 'NGP', station_name: 'Nagpur Junction', city: 'Nagpur', arrival_time: '13:50:00', departure_time: '13:55:00', distance_from_source: 1089 },
                    { stop_number: 5, station_code: 'AGC', station_name: 'Agra Cantt', city: 'Agra', arrival_time: '03:40:00', departure_time: '03:42:00', distance_from_source: 1986 },
                    { stop_number: 6, station_code: 'NDLS', station_name: 'New Delhi Railway Station', city: 'New Delhi', arrival_time: '06:30:00', departure_time: '06:30:00', distance_from_source: 2182 }
                ]
            },
            {
                train_number: 12951,
                train_name: 'Mumbai Rajdhani Express',
                source_code: 'CSTM',
                source_name: 'Chhatrapati Shivaji Maharaj Terminus',
                source_city: 'Mumbai',
                dest_code: 'NDLS',
                dest_name: 'New Delhi Railway Station',
                dest_city: 'New Delhi',
                total_coaches: 20,
                classes: [
                    { class_type: 'AC 1st Class (1A)', total_seats: 32, base_fare: 4200 },
                    { class_type: 'AC 2 Tier (2A)', total_seats: 120, base_fare: 2600 },
                    { class_type: 'AC 3 Tier (3A)', total_seats: 480, base_fare: 1850 }
                ],
                route: [
                    { stop_number: 1, station_code: 'CSTM', station_name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai', arrival_time: '17:00:00', departure_time: '17:00:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'ST', station_name: 'Surat', city: 'Surat', arrival_time: '19:43:00', departure_time: '19:48:00', distance_from_source: 263 },
                    { stop_number: 3, station_code: 'BRC', station_name: 'Vadodara Junction', city: 'Vadodara', arrival_time: '21:06:00', departure_time: '21:16:00', distance_from_source: 392 },
                    { stop_number: 4, station_code: 'NDLS', station_name: 'New Delhi Railway Station', city: 'New Delhi', arrival_time: '08:32:00', departure_time: '08:32:00', distance_from_source: 1384 }
                ]
            },
            {
                train_number: 16115,
                train_name: 'Chennai Egmore - Puducherry Express',
                source_code: 'MAS',
                source_name: 'Chennai Central',
                source_city: 'Chennai',
                dest_code: 'PDY',
                dest_name: 'Puducherry Railway Station',
                dest_city: 'Puducherry',
                total_coaches: 14,
                classes: [
                    { class_type: 'AC Chair Car (CC)', total_seats: 75, base_fare: 380 },
                    { class_type: 'Second Sitting (2S)', total_seats: 500, base_fare: 110 }
                ],
                route: [
                    { stop_number: 1, station_code: 'MAS', station_name: 'Chennai Central', city: 'Chennai', arrival_time: '18:10:00', departure_time: '18:10:00', distance_from_source: 0 },
                    { stop_number: 2, station_code: 'VM', station_name: 'Villupuram Junction', city: 'Villupuram', arrival_time: '21:15:00', departure_time: '21:20:00', distance_from_source: 159 },
                    { stop_number: 3, station_code: 'PDY', station_name: 'Puducherry Railway Station', city: 'Puducherry', arrival_time: '22:30:00', departure_time: '22:30:00', distance_from_source: 197 }
                ]
            }
        ]);
    }

    const bookingCount = await bookingsCol.countDocuments();
    if (bookingCount === 0) {
        await bookingsCol.insertMany([
            {
                booking_id: 1,
                pnr_number: '8421948210',
                user_id: 1,
                train_number: 20607,
                train_name: 'Vande Bharat Express',
                source_code: 'MAS',
                dest_code: 'SBC',
                journey_date: '2026-11-20',
                class_type: 'AC Chair Car (CC)',
                seat_number: 'C3-24',
                total_fare: 950.00,
                booking_status: 'Confirmed',
                payment_id: 'pay_mongo_demo_01',
                passenger_name: 'P. Karthikeyan',
                passenger_age: 28,
                passenger_gender: 'Male',
                database_source: 'MongoDB Atlas (NoSQL)',
                booking_date: new Date()
            }
        ]);
    }
    console.log("✓ MongoDB seeding completed successfully.");
}

module.exports = { seedDatabase };

if (require.main === module) {
    setupMongo();
}


