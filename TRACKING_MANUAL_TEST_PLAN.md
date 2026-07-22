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

## Driver bus onboarding and route assignment

Prepare active SLTB, Private, and Intercity routes for at least two depots. Each
route's depot name must match its depot master record.

1. Sign in as an approved driver without a verified bus. Confirm the app opens
   Register Your Bus through the access gate and shows Service Type and depot,
   with no editable Operator field.
2. Select each Service Type. Confirm Depot lists only depots with an active route
   for that service type, and changing Service Type clears Depot and Route.
3. Select a Depot. Confirm Route lists only active routes for that depot and
   service type. Changing Depot must clear the previous Route.
4. Submit the bus request and confirm Service Type, Depot, and Route appear in
   both the driver request summary and the admin review modal. Confirm no fixed
   route time is requested or stored during bus registration.
5. Tamper with the API payload using a route from another depot or another
   service type. Confirm the backend rejects every mismatch and does not create
   or revise the request.
6. Approve the request in Admin. Confirm the bus and driver records receive the
   selected route and service type, and the driver can reopen the app through
   DriverAccessGate without a missing-route error. Assign changing departure
   times separately through the Admin scheduling and daily-service workflow.
7. Open a pending request in Admin and select Edit request. Change vehicle,
   service type, depot, route, or optional vehicle details. Confirm dependent
   depot/route selections reset, invalid combinations are rejected, the request
   revision increments, and the refreshed list shows the updated values.
8. Edit a correction-required or rejected request. Confirm it returns to Under
   review, previous correction/rejection messages clear, and it can continue to
   approval. Edit an approved request and confirm its linked bus and driver route
   assignment are updated together.
9. Delete a pending, under-review, correction-required, or rejected request.
   Confirm the custom warning modal requires confirmation, the record disappears,
   and the driver returns to bus registration on the next access-gate check.
10. Delete an approved request and confirm only the request/audit record is
    removed while its already-approved bus and driver assignment remain active.

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

## Driver notifications

1. Open Driver Home and confirm the previous hamburger menu button is absent while
   the notification bell remains available.
2. Submit a driver issue and confirm Admin's To resolve tab includes both open
   and in-review reports. Resolve it with a required resolution note, confirm it
   moves to Resolved, and verify the Driver App receives the note in an Issue
   resolved notification. Confirm the All tab includes both groups.
3. Create several unread notifications, select Mark all as read, then close and
   reopen the Driver App. Confirm their read state remains saved in the backend.
4. Leave a notification unread, force-close and reopen the app, and confirm the
   notification and unread state remain available after sign-in.
5. Create 21 notifications for the same driver. Confirm the API returns only the
   newest 20 and the oldest record is removed from the notifications collection.

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
