# Project Status Audit

Last updated: 2026-07-19

## 1. Executive Summary

This repository is a multi-app smart bus tracking prototype with:

- `DriverApp/`: React Native CLI driver app.
- `PassengerApp/`: React Native CLI passenger app.
- `backend/`: Flask + MongoDB + Socket.IO API.
- `AdminApp/`: React + Vite operations console using the same Flask API and MongoDB database.
- `ml-model/`: Python ETA model training/prototype assets.

The project is no longer only OTP-based. The driver and admin flows now include JWT access tokens, role checks, and protected driver/admin/document endpoints. Driver session hydration and authorization headers are wired in the Driver app. Document upload now uses the backend Supabase Storage service with the current `storage3` client signature.

Driver trip start is now protected by backend-authoritative route-terminal geofencing. Route 123 uses the existing Kuliyapitiya Bus Stand and Kurunegala Bus Stand stop coordinates as configurable 500 m start terminals; the accepted GPS fix becomes the initial live bus position before the canonical Socket.IO event is emitted.

The project is still not production-ready. Major remaining gaps are background GPS delivery, push notifications, OCR/KYC automation, refresh tokens, rate limiting, deployment config, dependency documentation, production route-data seeding, and production-grade secret/key handling.

## 2. High-Level Architecture

```text
DriverApp
  -> DriverApp/src/services/api.ts
  -> Flask backend at http://10.0.2.2:5000 on Android or localhost on iOS
  -> OTP registration/login
  -> JWT bearer token session
  -> Protected driver home/status/profile/document APIs
  -> Supabase document upload through backend

PassengerApp
  -> Single-screen React Native map app
  -> Fetches bus data from backend
  -> Listens to Socket.IO bus_location_update events
  -> Calls ETA prediction endpoint

AdminApp
  -> React/Vite web console at http://localhost:5173
  -> Admin JWT login through the canonical Flask API
  -> Reviews drivers/KYC and monitors buses, trips, issues, and routes

Backend
  -> Flask + Flask-SocketIO
  -> MongoDB collections for drivers, buses, OTP, trips, shifts, notifications, routes, and issue reports
  -> JWT utilities and role decorators
  -> Admin login + protected driver/KYC, fleet, trip, issue, and route review APIs
  -> Driver OTP auth + protected driver dashboard/status/profile
  -> Supabase Storage document upload

ml-model
  -> Synthetic trip data generator
  -> RandomForestRegressor training script
  -> eta_model.pkl artifact used by backend
```

## 3. Current Technology Stack

| Area | Current status |
|---|---|
| Driver app | React Native CLI, TypeScript, React Navigation, Zustand, `react-native-keychain`, `react-native-image-picker` |
| Passenger app | React Native CLI, TypeScript, `react-native-maps`, Socket.IO client |
| Admin app | React, TypeScript, Vite, responsive operations console |
| Backend | Flask, Flask-SocketIO, PyMongo, PyJWT, bcrypt, TextLK OTP, Supabase Storage via `storage3` |
| Database | MongoDB, direct collection usage without formal schemas/migrations |
| ML | scikit-learn Random Forest + joblib model artifact |
| Testing | Backend contract suite passes in the project virtualenv; frontend production build still needs a dependency-enabled environment |
| Deployment | No Dockerfile, compose file, or CI workflow; backend `requirements.txt` and `.env.example` are present |

## 4. Confirmed Recent Improvements

### Authentication and Session

- Backend JWT utilities exist in `backend/utils/auth_utils.py:29`.
- Missing bearer tokens now return `Authentication token is required` in `backend/utils/auth_utils.py:62`.
- Role enforcement exists through `roles_required` in `backend/utils/auth_utils.py:108`.
- Driver route subject matching exists in `backend/utils/auth_utils.py:130`.
- Register OTP verification returns a driver token in `backend/routes/auth_routes.py:507`.
- Login OTP verification returns a driver token unless the driver is blocked/rejected in `backend/routes/auth_routes.py:609`.
- Driver app stores auth state through `DriverApp/src/store/useAuthStore.ts:34`.
- Driver app persists/loads session through `DriverApp/src/services/secureSession.ts:39`.
- Keychain calls are fail-safe so missing native Keychain module no longer blocks OTP flows in `DriverApp/src/services/secureSession.ts:29`.
- API requests attach `Authorization: Bearer <token>` in `DriverApp/src/services/api.ts:75`.
- FormData requests attach only authorization and do not manually set `Content-Type` in `DriverApp/src/services/api.ts:113`.
- OTP verification saves the auth session before navigation in `DriverApp/src/screens/OtpVerifyScreen.tsx:46`.
- App startup hydrates the stored session and routes approved drivers to Home, otherwise Pending Approval in `DriverApp/App.tsx:39` and `DriverApp/App.tsx:55`.

### Driver Approval Gate

- Driver home API requires JWT, driver role, and matching driver id in `backend/routes/auth_routes.py:626`.
- Pending/unverified drivers receive a 403 response from home with `Driver account has not been approved` in `backend/routes/auth_routes.py:652`.
- Driver profile and status APIs are also protected in `backend/routes/auth_routes.py:668` and `backend/routes/auth_routes.py:694`.
- Pending approval screen can poll protected status endpoint using the stored token.

### Admin Security

- Admin login exists at `POST /api/admin/login` in `backend/routes/admin_routes.py:89`.
- Admin password is verified against `ADMIN_PASSWORD_HASH` using bcrypt in `backend/routes/admin_routes.py:113`.
- Admin login returns a role=`admin` JWT in `backend/routes/admin_routes.py:128`.
- Admin driver list/approve/block/reject/pending-count routes require JWT + admin role in `backend/routes/admin_routes.py:145`, `backend/routes/admin_routes.py:187`, `backend/routes/admin_routes.py:226`, `backend/routes/admin_routes.py:269`, and `backend/routes/admin_routes.py:318`.
- `AdminApp/` is a React/Vite web console using the same Flask API and MongoDB, with driver KYC review, fleet, trip, issue, and route views.
- Dashboard operational endpoints are protected by admin JWT: `/api/admin/overview`, `/api/admin/buses`, `/api/admin/trips`, `/api/admin/issues`, `/api/admin/routes`, and issue status updates.

### Approval and Route Consistency

- Driver status serializers normalize legacy values such as `APPROVED` or padded values to the canonical lowercase contract used by DriverApp.
- Driver trip start refreshes the dashboard before checking approval, so an approval made in AdminApp is observed without relying on a stale pending cache.
- `/api/driver/trips/start` and `/api/driver/<driver_id>/home` accept only `approved`/`verified` drivers and still enforce vehicle and route assignments.
- The route service reads MongoDB first and can merge bundled development routes when `ENABLE_DEVELOPMENT_ROUTE_FALLBACK=true`; local fallback data includes routes 138, 122, and Route 123 with its two terminal geofences.
- Route terminals are optional backward-compatible fields, but trip start fails closed with `ROUTE_TERMINALS_NOT_CONFIGURED` unless at least two valid terminals exist.

### Admin Web CORS and Development Proxy

- Backend CORS examples include `http://localhost:5173`.
- AdminApp development requests use the Vite `/api` proxy to Flask, avoiding browser preflight problems during local development.

### Document Uploads

- Registration document keys are typed as camelCase keys in `DriverApp/src/types/registration.ts:20`.
- Post-registration uploader uses `RegistrationDocumentKey` and no longer uses snake_case names in `DriverApp/src/components/DocumentUploader.tsx:91`.
- Image picker quality is valid for `react-native-image-picker` at `quality: 0.8` in `DriverApp/src/components/DocumentUploader.tsx:97`.
- The `no-void` lint warning was removed by using `startDocumentUpload` in `DriverApp/src/components/DocumentUploader.tsx:153`.
- Pre-registration document upload remains unauthenticated because the driver does not exist yet in `backend/routes/document_routes.py:221`.
- Post-registration document upload is protected with driver JWT, role check, and subject match in `backend/routes/document_routes.py:300`.
- Backend validates real image signatures for JPEG/PNG/WebP in `backend/routes/document_routes.py:79`.
- Backend limits document size to 5 MB in `backend/routes/document_routes.py:92`.
- Supabase Storage URL normalization handles accidental `/rest/v1`, `/auth/v1`, `/realtime/v1`, and `/storage/v1` suffixes in `backend/utils/storage_service.py:19`.
- Supabase `storage3.create_client` is called with headers and `is_async=False` in `backend/utils/storage_service.py:81`.

### Backend Config Stability

- Backend `.env` is loaded relative to `backend/config.py` instead of process working directory in `backend/config.py:8`.
- `eta_model.pkl` is loaded using an absolute backend path in `backend/config.py:29`.
- Flask error handlers now return generic errors unless debug mode is enabled in `backend/app.py:70` and `backend/app.py:87`.

## 5. Current Endpoint Status

| Method | Endpoint | Auth | Current status |
|---|---|---|---|
| `POST` | `/api/driver/register/check-availability` | No | Checks duplicate mobile/email/NIC |
| `POST` | `/api/driver/register/request-otp` | No | Stores temporary registration + sends OTP |
| `POST` | `/api/driver/register/verify-otp` | No | Creates pending driver + returns JWT |
| `POST` | `/api/driver/login/request-otp` | No | Sends OTP for existing driver |
| `POST` | `/api/driver/login/verify-otp` | No | Returns JWT unless blocked/rejected |
| `GET` | `/api/driver/<driver_id>/home` | Driver JWT | Approved/verified drivers only |
| `GET` | `/api/driver/<driver_id>` | Driver JWT | Matching driver only |
| `GET` | `/api/driver/<driver_id>/status` | Driver JWT | Matching driver only |
| `POST` | `/api/driver/register/documents/upload` | No | Pre-account upload using mobile |
| `POST` | `/api/driver/<driver_id>/documents/upload` | Driver JWT | Matching driver only |
| `GET` | `/api/driver/<driver_id>/documents` | Driver JWT | Matching driver only |
| `DELETE` | `/api/driver/<driver_id>/documents/<doc_type>` | Driver JWT | Matching driver only |
| `POST` | `/api/admin/login` | No | Returns admin JWT |
| `GET` | `/api/admin/drivers` | Admin JWT | Lists drivers, optional status filter |
| `PATCH` | `/api/admin/drivers/<driver_id>/approve` | Admin JWT | Approves driver |
| `PATCH` | `/api/admin/drivers/<driver_id>/block` | Admin JWT | Blocks driver |
| `PATCH` | `/api/admin/drivers/<driver_id>/reject` | Admin JWT | Rejects driver with reason |
| `GET` | `/api/admin/drivers/pending-count` | Admin JWT | Counts pending drivers |
| `GET` | `/api/admin/overview` | Admin JWT | Dashboard metrics across shared collections |
| `GET` | `/api/admin/buses` | Admin JWT | Lists operational fleet state |
| `GET` | `/api/admin/trips` | Admin JWT | Lists recent trips with status filtering |
| `GET` | `/api/admin/issues` | Admin JWT | Lists driver issue reports |
| `PATCH` | `/api/admin/issues/<issue_id>` | Admin JWT | Updates issue status/resolution note |
| `GET` | `/api/admin/routes` | Admin JWT | Lists canonical route summaries |
| `GET` | `/api/admin/routes/<route_number>` | Admin JWT | Returns route geometry and stops |
| `POST` | `/api/location` | Driver JWT | Validates assignment/trip and stores bus location |
| `POST` | `/api/driver/trips/start` | Driver JWT | Validates fresh GPS against assigned route terminals, derives direction, creates trip, and initializes live bus location |
| `GET` | `/api/driver/trips/active` | Driver JWT | Restores the authenticated driver's active/paused trip |
| `POST` | `/api/driver/trips/<trip_id>/pause` | Driver JWT | Pauses an owned active trip and passenger visibility |
| `POST` | `/api/driver/trips/<trip_id>/resume` | Driver JWT | Resumes an owned paused trip after assignment checks |
| `POST` | `/api/driver/trips/<trip_id>/complete` | Driver JWT | Completes an owned trip and marks the bus offline |
| `GET` | `/api/buses` | No | Passenger bus list |
| `POST` | `/api/eta/predict` | No | ETA prediction for a live bus and route stop |
| `POST` | `/api/predict-eta` | No | Retired legacy ETA endpoint (410) |

## 6. Driver App Status

Status: PARTIAL but substantially wired.

Working or mostly wired:

- Multi-step registration flow with personal, driver/bus, document, and review screens.
- OTP login/registration calls backend services.
- Auth session store and startup hydration.
- Secure session persistence attempt via Keychain, with in-memory fallback if native module is unavailable.
- Pending/approved navigation gate.
- Protected driver home API call.
- Pending approval status polling.
- Post-registration document uploader.
- Active/paused/completed trip lifecycle with secure trip restoration in `DriverApp/src/store/useTripStore.ts`.
- Foreground GPS permission, location validation, retry/heartbeat behavior, and live transmission through `useDriverLocationTracking.ts`.
- Driver trip start now refreshes approval/assignment state before proceeding and handles legacy approval casing.
- Start preflight obtains a fresh precise location, submits coordinates/accuracy/timestamp to the backend, and creates the continuous watcher only after the backend accepts the terminal geofence.
- Driver UI reports location acquisition, terminal verification, nearest-terminal distance/radius, permission, accuracy, and missing-terminal states with retry/settings actions.
- Modernized auth/pending/home/bottom-nav UI styles from previous work.

Still incomplete:

- Background GPS delivery is not implemented; current tracking is foreground-oriented.
- Profile and Notifications still need production-complete workflows.
- There is no refresh token flow.
- Keychain durable storage requires a native rebuild after adding `react-native-keychain`.
- Development backend URL is still hard-coded by platform in `DriverApp/src/services/api.ts:35`.

## 7. Passenger App Status

Status: PARTIAL / functional prototype.

Working or mostly wired:

- Fetches bus list.
- Renders bus markers on a map.
- Listens to Socket.IO `bus_location_update`.
- Calls ETA endpoint.
- Uses route summaries/details, stop search, saved stops, route selection, and route-aware bus/ETA helpers.
- Renders route/stop context alongside live bus markers.

Still incomplete:

- No production passenger authentication/account flow.
- Backend URL is hard-coded to a local network value.
- Offline behavior is not implemented.

## 8. Backend Status

Status: PARTIAL but security is improved.

Implemented:

- Flask app with blueprints for auth, admin, documents, buses, and ETA.
- MongoDB collections configured for buses, drivers, OTP requests, trips, shifts, notifications, routes, and issue reports.
- JWT creation/validation and role decorators.
- Protected admin APIs.
- Protected driver home/profile/status APIs.
- Protected post-registration document APIs.
- Pre-registration document upload.
- Supabase Storage upload helper.
- Socket.IO setup.
- Authenticated driver GPS/location pipeline with stale, future, accuracy, movement, trip, and assignment validation.
- Backend-authoritative trip-start geofencing using the existing Haversine helper and per-terminal radii.
- Terminal-derived trip direction plus initial trip/bus coordinates and safe `bus_location_update` emission after successful writes.
- Route search/details/stops APIs with Mongo-backed canonical data and an explicit local development fallback.
- ETA model endpoint tied to live bus/route state.
- Admin operational APIs for dashboard, fleet, trips, issues, and routes.

Still incomplete:

- No `pyproject.toml`; the backend dependency manifest is `backend/requirements.txt`.
- Index bootstrap exists in `backend/utils/database_indexes.py`, but it is not yet a deployment migration workflow.
- No request schema validation library.
- No rate limiting.
- No refresh token/rotation strategy.
- No deployment config.
- Background location lifecycle, rate limiting, refresh-token rotation, and deployment hardening remain.

## 9. Database Status

MongoDB is used directly through collections:

- `buses`
- `drivers`
- `otp_requests`
- `trips`
- `driver_shifts`
- `notifications`
- `routes`
- `issue_reports`

Current concerns:

- Index definitions exist for identity fields, OTP expiry, route lookup, issue queues, and notifications in `backend/utils/database_indexes.py`; applying them automatically in deployment still needs a formal migration step.
- OTP values are stored directly in MongoDB until expiry.
- NIC and licence values are stored plaintext.
- Route documents use normalized `routeNumber`, `polyline`, ordered `stops`, and optional `terminals` (`id`, `name`, `latitude`, `longitude`, `startRadiusMeters`). Local fallback data includes 138/122/123 for development only when explicitly enabled.
- Existing routes are not destructively migrated. Routes without at least two valid terminals fail trip start safely and must be updated through an approved seed/admin process.
- The configured MongoDB was checked on 2026-07-19: Route 123 was absent, then inserted with `$setOnInsert` only. Read-back verified two 500 m terminals and six stops; no existing route was overwritten or deleted.
- No formal schema/migration versioning exists.

## 10. KYC and Document Status

Status: PARTIAL.

Implemented:

- NIC front/back and driving licence front/back document keys.
- Registration document upload flow.
- Post-registration document upload flow from pending approval screen.
- Backend image signature validation for JPEG/PNG/WebP.
- Backend 5 MB file limit.
- Supabase upload integration.
- AdminApp driver KYC review with submitted document links and approve/reject/block actions.

Remaining:

- OCR is not implemented.
- Automatic document-to-form matching is not implemented.
- Supabase storage currently returns public URLs.
- Bucket policy and key type must be verified. `SUPABASE_SERVICE_KEY` should be a server-only secret/service key, not a publishable/anon key.
- Signed URLs/private document access are not implemented.

## 11. Live Tracking and Maps

Status: PARTIAL.

Implemented:

- Backend `/api/location` stores a bus location and emits `bus_location_update`.
- Passenger app listens to the Socket.IO update and updates markers.
- An accepted trip-start fix updates the same canonical bus record and emits the same passenger-safe location contract as later `/api/location` updates.

Remaining:

- DriverApp collects and sends GPS during an active trip through `useDriverLocationTracking.ts`.
- `/api/location` requires a driver JWT and validates the current approved assignment/trip.
- Route geometry and ordered stops are available through the route service and route APIs.
- Retry/heartbeat behavior exists for transient GPS delivery failures.
- Exactly one foreground watcher is initialized after trip-start acceptance; the already-persisted initial fix is not immediately uploaded twice.

Operational assumption: the driver is expected to remain inside the assigned bus while operating the trip. The system treats the driver's active-trip phone GPS as the bus GPS and cannot independently prove that the phone remains in the vehicle.

Remaining:

- Background location delivery is not implemented.
- Durable offline GPS queueing is not complete.

## 12. ETA Status

Status: PROTOTYPE.

Implemented:

- Synthetic data generator.
- Random Forest training script.
- `eta_model.pkl` artifact.
- Backend ETA endpoint.
- Passenger call to ETA endpoint.

Limitations:

- Training data is synthetic.
- ETA requests are route-aware and require a live bus, route, and destination stop.
- The underlying model is still trained on synthetic data and needs real-world calibration/monitoring.
- No model versioning or monitoring.

## 13. Security Status

### Improved

- Admin driver APIs are no longer unauthenticated.
- Driver home/profile/status APIs are protected with JWT + role + subject match.
- Post-registration document APIs are protected with JWT + role + subject match.
- Backend error details are only returned in debug mode.
- Driver API client attaches bearer tokens automatically.
- Driver location updates require a driver JWT, approved assignment, active trip, and monotonic/stale-safe telemetry.

### Critical Remaining Risks

- OTP has no rate limiting, resend cooldown, retry counter, IP/device throttling, or lockout.
- No refresh token flow or token revocation list.
- Supabase document URLs are public.
- Hard-coded development URLs remain in mobile apps.
- Google Maps API key handling still needs review/rotation/restriction.
- Identity index definitions exist, but automated application and production verification are still incomplete.
- Device-level end-to-end tests and a broader API security test matrix are still incomplete; backend coverage now includes 58 passing tests and DriverApp Jest coverage includes 44 passing tests.

## 14. Build and Validation Results

Latest checks run in this workspace:

| Command | Directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `DriverApp/` | PASS |
| Modified-file ESLint | `DriverApp/` | PASS |
| `npm test -- --runInBand` | `DriverApp/` | PASS — 44 tests |
| `npx tsc --noEmit` | `PassengerApp/` | PASS |
| Passenger bus/socket/home focused Jest tests | `PassengerApp/` | PASS — 17 tests |
| Python `py_compile` for modified backend modules | repo root | PASS |
| `backend/venv/bin/python -m unittest discover -s backend/tests -v` | repo root | PASS — 58 tests |
| Passenger Socket.IO/parser contract inspection | repo root | PASS — no payload mismatch found; no Passenger code change required |
| MongoDB Route 123 conditional seed + read-back | configured backend database | PASS — inserted, 2 terminals, 6 stops, radii 500/500 m |

Not fully validated in this audit update:

- Android native rebuild/install was not completed in this update.
- iOS native rebuild was not run.
- AdminApp Vite production build was not run because frontend dependencies were unavailable from the package registry in this environment.
- Physical-device GPS/geofence behavior was not run in this audit update.
- Physical DriverApp → Flask → MongoDB → Passenger device end-to-end behavior was not run.
- End-to-end document upload against live Supabase was not run because network access is restricted in this environment.
- Authenticated security curl tests require a running local Flask server and valid driver/admin tokens.

## 15. Known Environment Notes

- Native package changes such as `react-native-keychain` require `npm run android` or `npm run ios`; Metro restart alone may not link native modules.
- If Keychain is unavailable, the app now falls back to in-memory session for the current run, but durable session persistence requires native rebuild.
- Flask must be restarted after backend changes.
- AdminApp Vite must be restarted after changing `vite.config.ts` or `VITE_API_URL`.
- For Android emulator, backend URL is `http://10.0.2.2:5000`.
- Route 123 terminal coordinates are copied from its existing first/last canonical stop coordinates: Kuliyapitiya Bus Stand (`7.4688`, `80.0401`) and Kurunegala Bus Stand (`7.4863`, `80.3647`).
- `ENABLE_DEVELOPMENT_ROUTE_FALLBACK=true` is local-development-only. Production should leave it disabled and store terminal fields in MongoDB.
- Supabase Storage upload requires:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `SUPABASE_BUCKET`
  - Existing bucket, currently expected as `driver-documents`

## 16. Feature Completion Estimate

| Area | Estimate | Reason |
|---|---:|---|
| Driver app | 70% | Registration, auth, approval gate, trip lifecycle, foreground GPS, home, and document upload are wired; profile/background tracking remain |
| Passenger app | 55% | Map/socket, route/stop search, saved stops, live bus context, and ETA flows exist; auth/offline polish remains |
| Backend | 72% | Core routes, JWT protections, trip/location validation, route service, admin APIs, and contract tests exist; schema/rate-limit/deploy gaps remain |
| Admin | 65% | React/Vite console covers protected review and operational monitoring; route CRUD, audit history, and role-specific permissions remain |
| KYC | 50% | Upload and AdminApp review workflow exist; OCR and private/signed document access remain |
| Live tracking | 60% | Driver foreground GPS, authenticated location writes, retry/heartbeat, Socket.IO passenger updates exist; background delivery remains |
| ETA | 60% | Live bus/route-aware endpoint exists; model is still synthetic and needs calibration/monitoring |
| Overall | 60% | A connected multi-app prototype with a working operations console, still not production-ready |

## 17. Top Priority Tasks

1. Add OTP rate limiting, resend cooldowns, retry limits, and account/IP throttling.
2. Apply MongoDB indexes through a repeatable deployment migration/bootstrap step.
3. Confirm `SUPABASE_SERVICE_KEY` is server-only and capable of storage writes.
4. Make document storage private or signed-url based.
5. Add background/foreground lifecycle handling for driver GPS delivery.
6. Seed official route geometry/stops into MongoDB and keep development fallback disabled in production.
7. Extend AdminApp with route CRUD, audit history, and role-specific admin permissions.
8. Add deployment config, pinned web dependencies, and CI checks.
9. Add broader frontend and authenticated API integration tests.

## 18. Recommended Roadmap

### Phase 1: Stabilize Current System

- Restart Flask and confirm login, pending status, approved home, and document upload manually.
- Rebuild Android/iOS after native dependency changes.
- Run the 48-test backend contract suite and the AdminApp production build in a dependency-enabled environment.
- Seed and verify official route documents for every assigned driver route.

### Phase 2: Harden Security

- Add rate limits and OTP cooldowns.
- Add integration coverage for authenticated bus location updates.
- Add unique indexes and duplicate checks for all identifiers.
- Move document storage to private/signed URLs.
- Rotate/restrict any exposed Google Maps keys.

### Phase 3: Complete Driver Operations

- Harden background/foreground GPS lifecycle.
- Add shift start/stop behavior.
- Add explicit route/bus assignment management from AdminApp.
- Complete Profile/Notifications screens.

### Phase 4: Complete Passenger Product

- Polish route search, stops, polylines, and stop-marker interactions.
- Improve ETA calibration with real route distance and live bus speed.
- Add offline/reconnect behavior.

### Phase 5: KYC and Admin

- Add route CRUD and audit history to AdminApp.
- Add OCR service.
- Compare OCR values against registration form values.
- Add approve/reject audit history.

## 19. Final Verdict

The project is now a connected multi-app prototype: DriverApp can run trips and transmit foreground GPS, PassengerApp consumes live buses/routes/ETA, and AdminApp manages driver KYC plus operational data through the same Flask/MongoDB backend. The biggest remaining production blockers are background GPS lifecycle, OTP hardening, official route-data seeding, private KYC storage, admin audit/role controls, deployment documentation, and broader integration testing.
