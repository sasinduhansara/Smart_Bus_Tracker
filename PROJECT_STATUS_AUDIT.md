# Project Status Audit

Last updated: 2026-07-14

## 1. Executive Summary

This repository is a multi-app smart bus tracking prototype with:

- `DriverApp/`: React Native CLI driver app.
- `PassengerApp/`: React Native CLI passenger app.
- `backend/`: Flask + MongoDB + Socket.IO API.
- `ml-model/`: Python ETA model training/prototype assets.

The project is no longer only OTP-based. The driver and admin flows now include JWT access tokens, role checks, and protected driver/admin/document endpoints. Driver session hydration and authorization headers are wired in the Driver app. Document upload now uses the backend Supabase Storage service with the current `storage3` client signature.

The project is still not production-ready. Major remaining gaps are driver GPS upload, route/stop management, push notifications, OCR/KYC automation, refresh tokens, rate limiting, deployment config, dependency documentation, and production-grade secret/key handling.

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

Backend
  -> Flask + Flask-SocketIO
  -> MongoDB collections for drivers, buses, OTP, trips, shifts, notifications
  -> JWT utilities and role decorators
  -> Admin login + protected admin driver review routes
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
| Backend | Flask, Flask-SocketIO, PyMongo, PyJWT, bcrypt, TextLK OTP, Supabase Storage via `storage3` |
| Database | MongoDB, direct collection usage without formal schemas/migrations |
| ML | scikit-learn Random Forest + joblib model artifact |
| Testing | TypeScript checks pass; Jest/deeper automated tests still incomplete |
| Deployment | No Dockerfile, compose file, CI workflow, `requirements.txt`, `pyproject.toml`, or `.env.example` found |

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
| `POST` | `/api/location` | No | Still unauthenticated bus location update |
| `GET` | `/api/buses` | No | Passenger bus list |
| `POST` | `/api/predict-eta` | No | ETA prototype endpoint |

## 6. Driver App Status

Status: PARTIAL but improved.

Working or mostly wired:

- Multi-step registration flow with personal, driver/bus, document, and review screens.
- OTP login/registration calls backend services.
- Auth session store and startup hydration.
- Secure session persistence attempt via Keychain, with in-memory fallback if native module is unavailable.
- Pending/approved navigation gate.
- Protected driver home API call.
- Pending approval status polling.
- Post-registration document uploader.
- Modernized auth/pending/home/bottom-nav UI styles from previous work.

Still incomplete:

- Driver app does not send real GPS updates to `/api/location`.
- Trips/Profile/Notifications are still mostly placeholder screens.
- There is no refresh token flow.
- Keychain durable storage requires a native rebuild after adding `react-native-keychain`.
- Development backend URL is still hard-coded by platform in `DriverApp/src/services/api.ts:35`.

## 7. Passenger App Status

Status: PARTIAL / prototype.

Working or mostly wired:

- Fetches bus list.
- Renders bus markers on a map.
- Listens to Socket.IO `bus_location_update`.
- Calls ETA endpoint.

Still incomplete:

- Single-screen app with no production navigation/auth flow.
- Backend URL is hard-coded to a local network value.
- Route/stops/polylines are not implemented.
- ETA uses prototype assumptions, not real route distance or live speed.
- Offline behavior is not implemented.

## 8. Backend Status

Status: PARTIAL but security is improved.

Implemented:

- Flask app with blueprints for auth, admin, documents, buses, and ETA.
- MongoDB collections configured for buses, drivers, OTP requests, trips, shifts, and notifications.
- JWT creation/validation and role decorators.
- Protected admin APIs.
- Protected driver home/profile/status APIs.
- Protected post-registration document APIs.
- Pre-registration document upload.
- Supabase Storage upload helper.
- Socket.IO setup.
- ETA model endpoint.

Still incomplete:

- No `requirements.txt` or `pyproject.toml`.
- No database migrations/index setup.
- No request schema validation library.
- No rate limiting.
- No refresh token/rotation strategy.
- No deployment config.
- Bus location endpoint is still unauthenticated.

## 9. Database Status

MongoDB is used directly through collections:

- `buses`
- `drivers`
- `otp_requests`
- `trips`
- `driver_shifts`
- `notifications`

Current concerns:

- No unique indexes confirmed for mobile, email, NIC, driving licence, vehicle registration, or NTC identifiers.
- OTP values are stored directly in MongoDB until expiry.
- NIC and licence values are stored plaintext.
- No route/stop collections were found.
- No migration/index bootstrap script was found.

## 10. KYC and Document Status

Status: PARTIAL.

Implemented:

- NIC front/back and driving licence front/back document keys.
- Registration document upload flow.
- Post-registration document upload flow from pending approval screen.
- Backend image signature validation for JPEG/PNG/WebP.
- Backend 5 MB file limit.
- Supabase upload integration.

Remaining:

- OCR is not implemented.
- Automatic document-to-form matching is not implemented.
- Admin document review UI is not implemented.
- Supabase storage currently returns public URLs.
- Bucket policy and key type must be verified. `SUPABASE_SERVICE_KEY` should be a server-only secret/service key, not a publishable/anon key.
- Signed URLs/private document access are not implemented.

## 11. Live Tracking and Maps

Status: PARTIAL.

Implemented:

- Backend `/api/location` stores a bus location and emits `bus_location_update`.
- Passenger app listens to the Socket.IO update and updates markers.

Remaining:

- Driver app does not collect/send GPS yet.
- `/api/location` is not authenticated.
- No route assignment, route geometry, or stop ordering.
- No background location sender.
- No offline queue for GPS events.

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
- ETA is not route-aware.
- Passenger app assumptions use straight-line distance and fixed speed.
- No model versioning or monitoring.

## 13. Security Status

### Improved

- Admin driver APIs are no longer unauthenticated.
- Driver home/profile/status APIs are protected with JWT + role + subject match.
- Post-registration document APIs are protected with JWT + role + subject match.
- Backend error details are only returned in debug mode.
- Driver API client attaches bearer tokens automatically.

### Critical Remaining Risks

- `/api/location` is unauthenticated and can update any bus id.
- OTP has no rate limiting, resend cooldown, retry counter, IP/device throttling, or lockout.
- No refresh token flow or token revocation list.
- Supabase document URLs are public.
- Hard-coded development URLs remain in mobile apps.
- Google Maps API key handling still needs review/rotation/restriction.
- No database unique indexes are confirmed for identity fields.
- No automated backend tests protect auth/document/security behavior.

## 14. Build and Validation Results

Latest checks run in this workspace:

| Command | Directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `DriverApp/` | PASS |
| `npx tsc --noEmit` | `PassengerApp/` | PASS |
| `find backend ... py_compile` | repo root | PASS |

Not fully validated in this audit update:

- Android native rebuild/install was not completed in this update.
- iOS native rebuild was not run.
- Jest tests were not rerun.
- End-to-end document upload against live Supabase was not run because network access is restricted in this environment.
- Authenticated security curl tests require a running local Flask server and valid driver/admin tokens.

## 15. Known Environment Notes

- Native package changes such as `react-native-keychain` require `npm run android` or `npm run ios`; Metro restart alone may not link native modules.
- If Keychain is unavailable, the app now falls back to in-memory session for the current run, but durable session persistence requires native rebuild.
- Flask must be restarted after backend changes.
- For Android emulator, backend URL is `http://10.0.2.2:5000`.
- Supabase Storage upload requires:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `SUPABASE_BUCKET`
  - Existing bucket, currently expected as `driver-documents`

## 16. Feature Completion Estimate

| Area | Estimate | Reason |
|---|---:|---|
| Driver app | 55% | Registration, auth session, pending gate, home, and document upload are wired; GPS/trips/profile remain incomplete |
| Passenger app | 35% | Map/socket/ETA prototype exists; route/stops/offline/product flow missing |
| Backend | 60% | Core routes and JWT protections exist; schema/index/rate-limit/deploy/test gaps remain |
| Admin | 30% | Backend auth/review APIs exist; admin UI missing |
| KYC | 35% | Upload pipeline exists; OCR/private review workflow missing |
| Live tracking | 35% | Backend/passenger side exists; driver GPS sender and auth missing |
| ETA | 45% | Prototype model/API exists; real data and route-aware logic missing |
| Overall | 45% | Stronger prototype foundation, still not production-ready |

## 17. Top Priority Tasks

1. Protect `/api/location` with driver/bus authorization.
2. Add OTP rate limiting, resend cooldowns, retry limits, and account/IP throttling.
3. Add MongoDB unique indexes for mobile, email, NIC, driving licence, vehicle registration, and NTC identifiers.
4. Confirm Supabase `SUPABASE_SERVICE_KEY` is server-only and capable of storage writes.
5. Make document storage private or signed-url based.
6. Implement driver foreground/background GPS sender.
7. Add route/stop collections and APIs.
8. Build an admin dashboard UI for pending/approved/rejected drivers and document review.
9. Add backend dependency manifest and `.env.example`.
10. Add automated tests for OTP, JWT guards, admin guards, document upload validation, and approval gating.

## 18. Recommended Roadmap

### Phase 1: Stabilize Current System

- Restart Flask and confirm login, pending status, approved home, and document upload manually.
- Rebuild Android/iOS after native dependency changes.
- Add `.env.example` and backend dependency file.
- Add simple backend smoke tests for auth guards.

### Phase 2: Harden Security

- Add rate limits and OTP cooldowns.
- Protect bus location update.
- Add unique indexes and duplicate checks for all identifiers.
- Move document storage to private/signed URLs.
- Rotate/restrict any exposed Google Maps keys.

### Phase 3: Complete Driver Operations

- Add driver GPS sender.
- Add shift start/stop behavior.
- Add route/bus assignment support.
- Complete Trips/Profile/Notifications screens.

### Phase 4: Complete Passenger Product

- Add route search and stops.
- Render route polylines and stop markers.
- Improve ETA with route distance and live bus speed.
- Add offline/reconnect behavior.

### Phase 5: KYC and Admin

- Build admin UI.
- Add document review workflow.
- Add OCR service.
- Compare OCR values against registration form values.
- Add approve/reject audit history.

## 19. Final Verdict

The project is now a stronger prototype than the previous audit: driver/admin JWT protection, secure session wiring, pending approval gates, and Supabase upload plumbing are implemented. The biggest remaining production blockers are live driver GPS transmission, `/api/location` authorization, OTP hardening, route/stop modeling, private KYC storage, dependency/deployment documentation, and automated tests.
