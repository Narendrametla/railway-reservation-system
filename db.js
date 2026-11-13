
const mysql = require('mysql2');
require('dotenv').config();

const isLocal = !process.env.DB_HOST ||
    process.env.DB_HOST === 'localhost' ||
    process.env.DB_HOST === '127.0.0.1';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || (isLocal ? 3306 : 4000),

    user: process.env.DB_USER || '4Gve9T66MxC7tSF.root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway_db',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    ssl: isLocal ? false : {
        rejectUnauthorized: true
    }
});

module.exports = pool.promise();
