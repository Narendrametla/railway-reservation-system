const db = require('./db');

async function setupDatabase() {
    console.log("Setting up DBMS Railway Reservation schema...");

    try {
        // 1. Users table (if not exists)
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                role ENUM('Admin', 'Passenger') DEFAULT 'Passenger',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✓ Table 'users' verified");

        // 2. Stations table
        await db.query(`
            CREATE TABLE IF NOT EXISTS stations (
                station_id INT AUTO_INCREMENT PRIMARY KEY,
                station_code VARCHAR(10) NOT NULL UNIQUE,
                station_name VARCHAR(100) NOT NULL,
                city VARCHAR(100) NOT NULL
            )
        `);
        console.log("✓ Table 'stations' verified");

        // 3. Trains table
        await db.query(`
            CREATE TABLE IF NOT EXISTS trains (
                train_number INT PRIMARY KEY,
                train_name VARCHAR(100) NOT NULL,
                source_station_id INT NOT NULL,
                destination_station_id INT NOT NULL,
                total_coaches INT NOT NULL,
                FOREIGN KEY (source_station_id) REFERENCES stations(station_id) ON DELETE RESTRICT ON UPDATE CASCADE,
                FOREIGN KEY (destination_station_id) REFERENCES stations(station_id) ON DELETE RESTRICT ON UPDATE CASCADE
            )
        `);
        console.log("✓ Table 'trains' verified");

        // 4. Train Classes
        await db.query(`
            CREATE TABLE IF NOT EXISTS train_classes (
                class_id INT AUTO_INCREMENT PRIMARY KEY,
                train_number INT NOT NULL,
                class_type VARCHAR(20) NOT NULL,
                total_seats INT NOT NULL,
                base_fare DECIMAL(8, 2) NOT NULL,
                FOREIGN KEY (train_number) REFERENCES trains(train_number) ON DELETE CASCADE ON UPDATE CASCADE
            )
        `);
        console.log("✓ Table 'train_classes' verified");

        // 5. Routes table
        await db.query(`
            CREATE TABLE IF NOT EXISTS routes (
                route_id INT AUTO_INCREMENT PRIMARY KEY,
                train_number INT NOT NULL,
                station_id INT NOT NULL,
                stop_number INT NOT NULL,
                arrival_time TIME,
                departure_time TIME,
                distance_from_source DECIMAL(7, 2) NOT NULL,
                FOREIGN KEY (train_number) REFERENCES trains(train_number) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE RESTRICT ON UPDATE CASCADE
            )
        `);
        console.log("✓ Table 'routes' verified");

        // 6. Bookings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS bookings (
                pnr_number VARCHAR(20) PRIMARY KEY,
                user_id INT NOT NULL,
                train_number INT NOT NULL,
                journey_date DATE NOT NULL,
                booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_fare DECIMAL(10, 2) NOT NULL,
                booking_status ENUM('Confirmed', 'Waiting', 'Cancelled') DEFAULT 'Confirmed',
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (train_number) REFERENCES trains(train_number) ON DELETE RESTRICT ON UPDATE CASCADE
            )
        `);
        console.log("✓ Table 'bookings' verified");

        // 7. Passengers table
        await db.query(`
            CREATE TABLE IF NOT EXISTS passengers (
                passenger_id INT AUTO_INCREMENT PRIMARY KEY,
                pnr_number VARCHAR(20) NOT NULL,
                name VARCHAR(100) NOT NULL,
                age INT NOT NULL,
                gender VARCHAR(10) NOT NULL,
                seat_number VARCHAR(20),
                class_type VARCHAR(20) NOT NULL,
                FOREIGN KEY (pnr_number) REFERENCES bookings(pnr_number) ON DELETE CASCADE ON UPDATE CASCADE
            )
        `);
        console.log("✓ Table 'passengers' verified");

        // 8. System logs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                log_message VARCHAR(255),
                logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("✓ Table 'system_logs' verified");

        // Seed initial stations if empty
        const [stationCount] = await db.query('SELECT COUNT(*) as count FROM stations');
        if (stationCount[0].count === 0) {
            console.log("Seeding stations...");
            await db.query(`
                INSERT INTO stations (station_code, station_name, city) VALUES
                ('NDLS', 'New Delhi Railway Station', 'New Delhi'),
                ('MAS', 'Chennai Central', 'Chennai'),
                ('SBC', 'KSR Bengaluru City', 'Bengaluru'),
                ('CSTM', 'Chhatrapati Shivaji Maharaj Terminus', 'Mumbai'),
                ('HWH', 'Howrah Junction', 'Kolkata'),
                ('PDY', 'Puducherry Railway Station', 'Puducherry'),
                ('HYB', 'Hyderabad Deccan', 'Hyderabad'),
                ('ADI', 'Ahmedabad Junction', 'Ahmedabad')
            `);
            console.log("✓ Stations seeded");
        }

        // Seed initial trains if empty
        const [trainCount] = await db.query('SELECT COUNT(*) as count FROM trains');
        if (trainCount[0].count === 0) {
            console.log("Seeding sample express trains...");
            // NDLS=1, MAS=2, SBC=3, CSTM=4, HWH=5, PDY=6, HYB=7, ADI=8
            await db.query(`
                INSERT INTO trains (train_number, train_name, source_station_id, destination_station_id, total_coaches) VALUES
                (20607, 'Vande Bharat Express', 2, 3, 16),
                (12952, 'Mumbai Rajdhani Express', 1, 4, 22),
                (12007, 'Shatabdi Express', 2, 3, 18),
                (12840, 'Howrah Mail', 2, 5, 24),
                (12615, 'Grand Trunk Express', 2, 1, 24),
                (16116, 'Auroville Intercity', 6, 2, 14)
            `);

            // Seed classes for trains
            await db.query(`
                INSERT INTO train_classes (train_number, class_type, total_seats, base_fare) VALUES
                (20607, 'Executive Chair (EC)', 52, 1850.00),
                (20607, 'AC Chair Car (CC)', 450, 950.00),
                (12952, 'First AC (1A)', 24, 3850.00),
                (12952, '2 Tier AC (2A)', 120, 2450.00),
                (12952, '3 Tier AC (3A)', 320, 1680.00),
                (12007, 'AC Chair Car (CC)', 380, 890.00),
                (12840, 'Sleeper (SL)', 480, 560.00),
                (12840, '3 Tier AC (3A)', 240, 1450.00),
                (12615, 'Sleeper (SL)', 500, 680.00),
                (16116, 'Second Sitting (2S)', 320, 120.00)
            `);
            console.log("✓ Sample trains and classes seeded");
        }

        console.log("Railway Reservation DBMS schema initialization complete!");
        process.exit(0);

    } catch (err) {
        console.error("Database setup failed:", err);
        process.exit(1);
    }
}

setupDatabase();
