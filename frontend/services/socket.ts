import { io, Socket } from 'socket.io-client';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';
const SOCKET_URL = API_BASE;

export type BusLocation = {
  busNumber: string;
  latitude: number;
  longitude: number;
  speed: number;
  eta: number;
  timestamp: string;
};

let socket: Socket | null = null;

export function connectSocket(onUpdate: (bus: BusLocation) => void) {
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
  socket.on('bus_location_update', (data: BusLocation) => onUpdate(data));
  socket.on('bus_removed', (_data: { busNumber: string }) => {
    // handled by caller via list diff
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export async function fetchActiveBuses(): Promise<Record<string, BusLocation>> {
  const res = await fetch(`${API_BASE}/api/active-buses`);
  if (!res.ok) throw new Error('Failed to fetch active buses');
  const list: BusLocation[] = await res.json();
  const map: Record<string, BusLocation> = {};
  for (const b of list) map[b.busNumber] = b;
  return map;
}

export async function sendDriverLocation(data: BusLocation) {
  if (!socket?.connected)
    throw new Error('Socket not connected');
  socket.emit('driver_location', data);
}

export async function sendTripEnded(busNumber: string) {
  if (!socket?.connected)
    throw new Error('Socket not connected');
  socket.emit('trip_ended', { busNumber });
}
