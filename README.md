# Railway Reservation System (DBMS Project)

A complete Railway Reservation System built with Node.js, Express, MySQL, and Tailwind CSS.

---

## Prerequisites
- **Node.js** (v16 or higher)
- **MySQL Server** (e.g. MySQL 8.0, XAMPP, or MariaDB) running locally

---

## 1. Configure Database Connection

Create or update the `.env` file in the project root:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=railway_db
```

Replace `your_mysql_password` with your actual MySQL `root` password.

---

## 2. Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

---

## 3. Initialize the Database & Seed Data

Run the database setup script. This will automatically create the `railway_db` database (if it doesn't already exist), set up all tables (`users`, `stations`, `trains`, `train_classes`, `routes`, `bookings`, `passengers`, `system_logs`), and seed sample trains and stations:

```bash
npm run setup
```
*(or `node setup_database.js`)*

---

## 4. Run the Application

Start the server:

```bash
npm start
```
*(or `node server.js`)*

---

## 5. Open in Your Browser

- **Home Page / Booking:** [http://localhost:5000](http://localhost:5000)
- **Login / Register:** [http://localhost:5000/login](http://localhost:5000/login)
- **Dashboard:** [http://localhost:5000/dashboard](http://localhost:5000/dashboard)
- **Database Status Check:** [http://localhost:5000/api/db-status](http://localhost:5000/api/db-status)