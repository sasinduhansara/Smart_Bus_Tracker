import { BusLocation } from '@/services/socket';

export async function loadRoutes() {
  const res = await fetch('http://localhost:5000/api/routes');
  if (!res.ok) throw new Error('Failed to load routes');
  return res.json();
}

export type { BusLocation };
