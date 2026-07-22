# Gamana.lk – Deployment Guide

Instructions for deploying the OpenStreetMap-based live tracking stack to production environments.

---

## 1. Prerequisites

- **Python 3.11+** with virtual environment
- **MongoDB 6.0+** with 2dsphere index support
- **OSRM Server** instance (self-hosted or public endpoint)
- **Node.js 18+** & npm for React Native and Web AdminApp
- **Redis 7.0+** (optional, recommended for multi-worker Socket.IO and rate limiting)

---

## 2. Environment Configuration

Copy `.env.example` to `.env` in `backend/`:

```env
MONGO_URI=mongodb://localhost:27017
CORS_ORIGINS=http://localhost:5173,http://localhost:8081
MAP_STYLE_URL=https://demotiles.maplibre.org/style.json
OSRM_BASE_URL=http://router.project-osrm.org
LOCATION_HISTORY_TTL_DAYS=90
RATE_LIMIT_ENABLED=true
```

---

## 3. Database Index Setup

Run index initialization before starting the application for the first time:

```bash
cd backend
python -c "from utils.database_indexes import ensure_safe_indexes; ensure_safe_indexes()"
```

---

## 4. Running Backend with Gunicorn / Eventlet

For production deployment with Socket.IO support:

```bash
gunicorn --worker-class eventlet -w 1 app:app -b 0.0.0.0:5000
```

---

## 5. Mobile Apps Build (DriverApp & PassengerApp)

Ensure MapLibre native dependencies are linked:

```bash
# DriverApp / PassengerApp
npm install
cd ios && pod install && cd ..  # iOS build
npx react-native run-android --mode=release  # Android release APK
```

---

## 6. Training the ML ETA Model

To re-train the ETA model on captured real-world trip data:

```bash
cd ml-model
python train_real.py --output ../backend/eta_model.pkl
```
