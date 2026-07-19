# BusTrack LK Admin Console

The admin console is a React/Vite web frontend for the existing Flask API. It does **not** connect to MongoDB from the browser and does not create a second backend. Driver approvals, fleet state, trips, issues and routes all use the same `smart_bus_db` collections consumed by DriverApp and PassengerApp.

## Run locally

1. Start MongoDB and configure `backend/.env` with `MONGO_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH`.
2. Start the API from `backend/` using the existing project instructions.
3. From this directory, optionally copy `.env.example` to `.env`, then run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Flask during development, avoiding browser CORS preflight issues. The admin email/password are the values configured in the Flask backend. The token is kept in `sessionStorage` and sent as a Bearer token to protected `/api/admin/*` endpoints.

## Production build

```bash
npm run build
npm run preview
```

Set `VITE_API_URL` to the deployed Flask API `/api` origin. MongoDB credentials must remain server-side in Flask; never put them in Vite environment variables.
