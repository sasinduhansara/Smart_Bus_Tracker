# 🚌 Smart Bus Tracker (GamanaLK)

Full-stack bus fleet management system with real-time tracking.

## 📁 Project Structure

```
SmartBusTracker/
├── backend/               # Python Flask REST API
├── admin-web/             # React + Vite Admin Dashboard
├── frontend/              # React Native (Expo) Mobile App
└── README.md
```

---

## 🔧 Requirements (Okkomatama Install Karanna Ona De)

| Component | Technology | Required Installations |
|-----------|-----------|----------------------|
| **Backend** | Python Flask | Python 3.10+ , MongoDB Atlas account |
| **Admin Web** | React + Vite | Node.js 18+ |
| **Mobile App** | React Native (Expo) | Node.js 18+, Expo CLI |
| **Database** | MongoDB Atlas | Cloud account (free tier ok) |

---

## 🚀 How to Run (Project Eka Clone Karala Run Karanna)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/sasinduhansara/Smart_Bus_Tracker.git
cd Smart_Bus_Tracker
```

---

### 2️⃣ Backend Setup (Python Flask API)

```bash
cd backend

# 2.1 - Create virtual environment (venv hadanwa)
python3 -m venv venv

# 2.2 - Activate venv (Mac/Linux)
source venv/bin/activate

# 2.3 - Install Python packages (requirements install karanwa)
pip install -r requirements.txt

# 2.4 - Create .env file (MONGO_URI eka danna)
# .env file eka create karala mongo connection eka danna
# Mona da danna one kiyala .env.example file eka balanna
touch .env
```

**`.env` file eke contents:**
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/bus_tracker?retryWrites=true&w=majority
SECRET_KEY=your_secret_key_here
ADMIN_JWT_SECRET=admin_jwt_secret_here
PASSENGER_JWT_SECRET=passenger_jwt_secret
```

> 💡 **MONGO_URI eka ganna:** MongoDB Atlas eke login wela → Database → Connect → Drivers → Connection string eka copy karanna

```bash
# 2.5 - Run backend server
python app.py

# Server eka http://localhost:5000 port eken start wenawa
```

**Check karanna:** Browser eken `http://localhost:5000/api/health` open karanna — `{"status": "ok"}` pennanna one.

---

### 3️⃣ Admin Web Dashboard (React + Vite)

```bash
# 3.1 - Go to admin-web folder
cd admin-web

# 3.2 - Install dependencies (node_modules install karanwa)
npm install

# 3.3 - Run development server
npx vite

# Server eka http://localhost:3000 port eken open wenawa
```

**Login Credentials (Auto-created):**
- **Email:** `admin@gamanalak.com`
- **Password:** `admin123`

> ⚠️ API URL eka `admin-web/src/services/api.ts` eke thiyenawa. Default eka `http://localhost:5000/api`. Backend server eka wenam port ekakda run karoth meka change karanna.

---

### 4️⃣ Mobile App (React Native Expo)

```bash
cd frontend

# Install dependencies
npm install

# Run with Expo
npx expo start
```

- QR code eka scan karanna Expo Go app eken
- Ya mobile device ekata install karaganna

> 📱 **Important:** Real device ekakin test karanna nam backend server eka aho IP ekata change karanna.
> Edit `frontend/services/api.js` file eke API_BASE_URL eka.

---

## 🗄️ Database Setup (MongoDB Atlas - Free Tier)

1. **Create MongoDB Atlas Account:**
   - Go to https://www.mongodb.com/atlas
   - Sign up (free tier ekak)

2. **Create Cluster:**
   - Click "Create Cluster" → Select M0 Free Tier
   - Cloud Provider: AWS → Region: Mumbai (ap-south-1) (Sri Lankata closest)
   - Wait cluster eka create wenakam (2-3 mins)

3. **Setup Database Access:**
   - Security → Database Access → Add New User
   - Username + Password create karanwa
   - Built-in Role: "Atlas Admin"

4. **Network Access:**
   - Security → Network Access → Add IP
   - `0.0.0.0/0` danna (Allow Access from Anywhere) [development wenuwen]
   - Production eke nattam specific IP danna

5. **Get Connection String:**
   - Cluster → Connect → Drivers
   - Copy connection string eka
   - `<username>` & `<password>` replace karala `.env` eke danna

---

## 🛠️ Common Issues & Solutions

### "mongodb connection failed"
- `.env` file eke MONGO_URI eka check karanna
- Password eke special characters (like @#$) tiyenam URL encode karanna
- Network Access eke IP allow karala tiyenawa kiyala check karanna

### "port already in use"
```bash
# Backend port 5000 use karala inna process eka stop karanna
lsof -i :5000
kill -9 <PID>
```

### "npm command not found"
- Node.js install karala tiyenawa kiyala check karanna: `node --version`
- Download: https://nodejs.org/ (LTS version)

### "python3 command not found"
```bash
# Mac: brew install python
# Linux: sudo apt install python3
# Windows: https://python.org/downloads/
```

---

## 📞 Contact

Project maintainer: Sasindu Hansara
