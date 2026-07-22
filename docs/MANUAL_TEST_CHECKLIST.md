# Gamana.lk – Manual Test Checklist

Pass/Fail verification items for verifying the live bus tracking feature.

---

## Phase 1: Geometry & Admin Editor
- [ ] Log in as Admin on `AdminApp` (`/routes`)
- [ ] Click **Edit Route Geometry** for a route
- [ ] Draw/modify route geometry control points on MapLibre canvas
- [ ] Click **Save & Approve Geometry**; verify status badge updates to `GeoJSON Approved (vX)`
- [ ] Verify `stops` collection is updated with GeoJSON `Point` documents

---

## Phase 2: Driver Navigation & GPS Tracking
- [ ] Log in as Driver on `DriverApp`
- [ ] Start an assigned duty trip
- [ ] Open **Live Route Map** tab; confirm MapLibre map renders with route polyline
- [ ] Simulate GPS location update (e.g. via Android Emulator location mock)
- [ ] Confirm position snaps to route line and `snappedPosition` reports back in UI
- [ ] Drive off-route; confirm `isRouteDeviation` flag triggers after deviation threshold

---

## Phase 3: Passenger Live Tracking
- [ ] Open `PassengerApp` on device/emulator
- [ ] Confirm OpenStreetMap base tiles load without Google Maps key
- [ ] Select a route from route selector chip list
- [ ] Confirm active buses display with smooth icon placement
- [ ] Tap a bus icon; confirm bottom card details (bus number, next stop, ETA) update
- [ ] Confirm room subscription (`subscribe_route`) reduces unneeded socket traffic

---

## Phase 5 & 6: ETA & Rate Limiting
- [ ] Request ETA prediction for a destination stop; verify estimated arrival time returns
- [ ] Test rate limiting by issuing >60 ETA requests in 1 minute; confirm `429 Too Many Requests` is returned
