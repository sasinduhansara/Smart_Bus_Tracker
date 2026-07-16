# Security configuration and follow-up

This document records security-sensitive setup that must remain outside source
control. It does not indicate that previously exposed credentials have been
rotated.

## Google Maps API key

The Passenger Android application ID is `com.passengerapp`. The application
reads `GOOGLE_MAPS_API_KEY` from the process environment first, then from
`PassengerApp/android/local.properties`. The manifest receives it through a
Gradle manifest placeholder. The empty fallback exists only so static checks
that do not use Maps can evaluate the configuration.

The key previously committed to the repository must be treated as exposed.
Complete these steps manually:

1. Open Google Cloud Console and select the project that owns the exposed key.
2. Locate the exposed key under APIs & Services > Credentials.
3. Disable or delete the exposed key.
4. Create a replacement key.
5. Set its application restriction to Android apps.
6. Add the Android application ID `com.passengerapp`.
7. Add the real SHA-1 fingerprint for each permitted signing certificate.
8. Restrict the key to only the required Maps SDK/API.
9. Store the replacement only in `PassengerApp/android/local.properties` or
   the `GOOGLE_MAPS_API_KEY` environment variable.
10. Never commit the replacement key.

Obtain the debug signing SHA-1 locally; do not commit the output:

```sh
cd PassengerApp/android
./gradlew signingReport
```

The repository change removes the key from the current source tree, but it
does not remove the old value from Git history and does not rotate it.

## Identity-document storage finding

### Current behaviour

- `backend/utils/storage_service.py` uploads NIC and driving-licence images to
  the configured Supabase bucket and calls `get_public_url()`.
- The repository does not define the bucket policy, so its public/private state
  must be verified in the Supabase dashboard. The current API design expects a
  durable URL; that URL is directly accessible when the bucket is public.
- Document URLs and object paths are stored in each driver's `documents`
  record and returned by registration, driver-document and admin responses.
- Authenticated driver upload, list and delete endpoints require a driver JWT,
  the `driver` role and matching token subject. The pre-registration upload
  endpoint cannot use a driver JWT and accepts a normalized mobile identifier.
- Admin driver-list access requires an admin JWT and the `admin` role.
- No signed-URL generation is implemented in the current backend.

### Risk

A public bucket or leaked durable URL can expose long-lived NIC and
driving-licence images. The unauthenticated pre-registration upload endpoint
also needs rate limiting and an upload-authorization design before production.

### Recommended migration

Use a private Supabase bucket, store only object paths, and return short-lived
signed URLs only after authorizing the requesting driver or administrator.
This migration should be completed as one tested change across:

- Supabase dashboard bucket policy and storage rules.
- `backend/utils/storage_service.py` for private uploads and signed URLs.
- `backend/routes/document_routes.py` for owner-authorized URL issuance.
- `backend/routes/admin_routes.py` and `backend/routes/auth_routes.py` to avoid
  returning durable public URLs.
- `DriverApp/src/services/api.ts`, document types, registration screens,
  `DocumentUploader.tsx`, and `PendingApprovalScreen.tsx` for expiring URLs.

Existing objects and stored document records need a planned migration. The
storage architecture is intentionally not changed by this hardening branch.

## Repository hygiene review

- The generated JVM crash log is excluded by root ignore rules and is not
  tracked.
- The accidental nested `Users/.../DriverApp/fix_imports.py` maintenance script
  was removed because it was unreferenced, rewrote source files when executed,
  and was not part of the application or build.
- `DriverApp/.bundle/config` and `PassengerApp/.bundle/config` are retained:
  both contain the same non-secret Bundler settings for a project-local gem
  path and Ruby platform behaviour.
- `.vscode/launch.json` is retained as an intentionally shared development
  launch profile; other `.vscode` files remain ignored.
