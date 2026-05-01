# 🎓 BunkerMate | Anonymous Device-Based Attendance Tracker

**BunkerMate** is a premium, full-stack application for students to manage their attendance and calculate "bunkable" classes. Data is stored in a **PostgreSQL database** and uniquely identified by your browser session (no accounts required!). 

## 🚀 Key Features

- **🛡️ Anonymous Tracking**: No registration required. Your data is tied to your unique device/browser instance.
- **☁️ Cloud Persistence**: Data is saved in PostgreSQL, ensuring it's safe even if you refresh or clear minor caches.
- **📊 Dynamic Dashboard**: At-a-glance view of overall attendance and safe bunk counts.
- **🧮 Intelligent Calculator**: Calculates if you're "Safe" to skip or in "Danger".
- **🎨 Stellar Design**: Premium dark theme with moving classroom graphics.
- **📱 Mobile Friendly**: Seamless experience across all devices.

## 🛠️ Full-Stack Setup

### 1. Database Initialization
Ensure PostgreSQL is running. Run the setup script:
```bash
psql -U your_user -d your_db -f init.sql
```

### 2. Backend Configuration
1. Install Node.js dependencies: `npm install`
2. Update `.env` with your `DATABASE_URL`.
3. Start the server: `npm start`

### 3. Frontend
Open `index.html`. The app will automatically generate a unique Device ID and communicate with the backend at `http://localhost:5000`.

## 📖 Tech Stack
- **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JS.
- **Backend**: Node.js, Express.
- **Database**: PostgreSQL.
- **Icons**: Lucide Icons.

---
*BunkerMate - Miss classes, but stay safe at 75%.*. https://bunkermate.teamnexterp.com/
