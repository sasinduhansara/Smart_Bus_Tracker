# Passenger Journey Planner and Timetable - Phase 2

## Updated files

- `PassengerApp/src/types.ts`
- `PassengerApp/src/services/api.ts`
- `PassengerApp/src/screens/RouteExplorerScreen.tsx`
- `PassengerApp/src/components/home/QuickActionGrid.tsx`

## New files

- `PassengerApp/src/components/journey/StopSearchField.tsx`
- `PassengerApp/src/components/journey/ServiceFilterChips.tsx`
- `PassengerApp/src/components/journey/RouteResultCard.tsx`
- `PassengerApp/src/components/journey/TimetableServiceCard.tsx`

## Implemented flow

1. Search and select a start stop.
2. Search and select a destination stop.
3. Select one of the next seven travel dates.
4. Filter by All, SLTB, Private, or AC.
5. Find routes containing both stops in the correct order.
6. Open a route to view future scheduled services.
7. Show departure, destination arrival, duration, bus, operator, driver, and status.
8. Keep live tracking disabled until the linked driver trip starts.
9. Open the existing live map when `liveTrackingAvailable` is true.

## Service type mapping

- All: no service filter
- SLTB: `sltb`
- Private: `private`
- AC: `intercity`

AC remains a frontend label for the canonical backend `intercity` value.

## Install

From the Smart Bus Tracker repository root:

```bash
unzip -o ~/Downloads/passenger-frontend-phase2.zip \
  -d /Users/sasindu/Desktop/smart-bus-tracker
```

## Verify

```bash
cd /Users/sasindu/Desktop/smart-bus-tracker/PassengerApp
npm run lint
npx tsc --noEmit
```

Then run the app:

```bash
npm run android
```

or:

```bash
npm run ios
```
