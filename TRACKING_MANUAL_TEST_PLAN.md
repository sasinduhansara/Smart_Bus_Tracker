# Driver Registration and Live Tracking Manual Test Plan

## Scope and operating assumption

Foreground trip readiness and live tracking are implemented. During an active
trip, the driver's phone is the bus tracker and must remain inside the assigned
bus. Phone GPS cannot independently prove that the phone remains on that bus.

Backend defaults are configurable with `ROUTE_SNAP_THRESHOLD_METERS` (75 m),
`ROUTE_DEVIATION_THRESHOLD_METERS` (100 m), and
`BUS_LOCATION_TTL_SECONDS` (120 s).

True screen-locked/background delivery is not enabled yet and must not be
described as always-live until the native lifecycle below is implemented and
validated on physical Android and iOS devices.

## Driver registration and OTP scenarios

Use new test identities that do not belong to real drivers. Record the API
response code and a screenshot for every rejected or interrupted state.

1. Open registration and confirm the flow contains Personal Information, Driver
   Qualifications, optional KYC Documents, and Review & Submit. Route, vehicle,
   bus permit, and conductor fields must not appear because operations assigns
   them after registration.
2. Enter invalid NIC, mobile, email, and password values. Confirm inline errors
   appear and the form cannot continue. Confirm the password visibility button
   has an accessible Show/Hide label.
3. Enter a valid NIC, mobile, and email slowly. Confirm each field performs one
   debounced availability check, shows Checking, then Available, without sending
   a request for every keystroke.
4. Use an existing NIC, mobile, or email. Confirm the conflicting field is
   identified, Next remains unavailable, and changing the value performs a new
   check. Disable the network and confirm the UI explains that availability will
   be checked again when continuing.
5. Enter the Driver NTC registration number and driving licence number. Confirm
   they are normalized to uppercase in the submitted payload. Confirm a past
   licence-expiry date cannot be selected or submitted and today/future dates can.
6. Leave Operator / Depot empty and continue successfully. Repeat with a value and
   confirm it is included without becoming an operational bus assignment.
7. On KYC Documents, test Camera and Gallery for all four document types. Confirm
   files over 5 MB are rejected, only one upload runs at a time, completed uploads
   show their status, removal works, and leaving the screen cancels an in-flight
   upload safely.
8. Skip all documents and confirm registration can continue with KYC status Not
   Submitted. Repeat with all four verified upload references and confirm the
   review screen reports them as Uploaded without exposing storage credentials.
9. On Review & Submit, verify normalized personal and licence details, optional
   document status, checkbox accessibility, and that submission remains disabled
   until confirmation is checked.
10. Submit twice quickly. Confirm one registration OTP reservation is active,
    passwords are stored only as hashes, and the OTP/SMS provider response is not
    exposed to the app.
11. Enter non-digits and more than six digits on OTP verification. Confirm the UI
    retains only six digits, supports OS one-time-code autofill, and enables Verify
    only at six digits. Test invalid, expired, reused, and correct OTP values.
12. After successful registration verification, confirm one clean pending driver
    record is created with canonical mobile/email/NIC/NTC/licence identity keys,
    no route/vehicle/permit/conductor assignment fields, and navigation goes to
    Pending Approval. Confirm a duplicate NTC or licence is rejected safely, then
    assign route and vehicle later through the authorised operations workflow.

## Live tracking physical-device scenarios

Use an approved test driver with a real bus and route assignment. Use a second
physical device for the Passenger App and record timestamps/screenshots for each
result.

1. Open Driver Home with foreground precise-location permission already granted.
   Confirm one automatic readiness watcher starts and no passenger bus event is
   produced before trip start.
2. Start outside both configured terminal areas. Confirm Start Trip is absent or
   disabled and the nearest terminal, allowed radius, GPS accuracy, and remaining
   distance are shown without raw coordinates.
3. Move toward the terminal. Confirm the remaining distance decreases without a
   manual refresh and stays physically plausible.
4. Cross the configured 500 m boundary. Confirm the screen changes to Ready to
   start and shows the backend-derived origin and destination.
5. Press Start Trip twice quickly. Confirm only one trip is created and continuous
   tracking begins only after backend acceptance.
6. On the Passenger map, confirm one marker appears for the canonical bus ID, the
   stored route polyline and ordered stops render, and no driver identity appears.
7. Drive along the route. Confirm the same bus marker animates, rotates with valid
   heading, follows the route when GPS is close, and freshness/ETA update at their
   controlled intervals.
8. Safely create three accurate off-route fixes. Confirm raw GPS is displayed,
   snapping does not hide the deviation, and both Driver and Passenger warnings
   appear. Return to the route and confirm the warning clears.
9. Disable network during an active trip, move, then reconnect within 30 seconds.
   Confirm the bounded queue keeps active-trip telemetry only, the newest fresh
   fix becomes current, no burst floods the backend, and marker identity remains
   unchanged.
10. Pause and resume. Confirm no watcher exists while paused and exactly one active
    watcher is restored after backend validation.
11. Force-close/relaunch with an active trip. Confirm the secure trip is validated
    and exactly one watcher is restored.
12. Complete the trip. Confirm all watchers stop, the queue clears after successful
    completion, and Passenger status changes immediately to Offline.

## Native background capability still required

Recommended implementation is a dedicated Android Kotlin foreground location
service using `FusedLocationProviderClient` and an iOS `CLLocationManager`
active-trip coordinator, both connected to the existing trip/session/API flow.
No second JavaScript GPS or Socket.IO system should be introduced.

Android work requires `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_LOCATION`, a `foregroundServiceType="location"` service,
a persistent “Live bus trip in progress” notification, Android 13+
notification handling, process-restart deduplication, and version-specific
background-location permission only if physical-device behavior proves it is
required. Rebuild and validate with the existing Gradle/React Native Android
commands after approval.

iOS work requires the `location` background mode, appropriate When In Use versus
Always authorization for the approved lifecycle, complete usage descriptions,
`allowsBackgroundLocationUpdates` only during an active trip, automatic shutdown
at pause/completion/logout, a Pods/native rebuild, and physical-device validation.

Before release, update the privacy notice and store disclosures for active-trip
background location, explain the persistent indicator/notification, document
retention, and confirm that background collection never runs without an active
trip.
