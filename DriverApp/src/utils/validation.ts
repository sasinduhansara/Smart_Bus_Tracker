export function isValidMobile(mobile: string): boolean {
  const cleaned = mobile.replace(/[\s-]/g, '');
  return cleaned.length >= 9 && /^[0-9]+$/.test(cleaned);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidNIC(nic: string): boolean {
  // Sri Lanka NIC: 9 digits + V/X, or 12 digits
  return /^[0-9]{9}[VvXx]?$/.test(nic) || /^[0-9]{12}$/.test(nic);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function isValidBusRoute(route: string): boolean {
  return route.trim().length > 0;
}

export function isTodayOrFutureDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;

  const selectedDate = new Date(year, month - 1, day);
  if (
    selectedDate.getFullYear() !== year ||
    selectedDate.getMonth() !== month - 1 ||
    selectedDate.getDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);

  return selectedDate.getTime() >= today.getTime();
}

export function isValidVehicleRegistrationNumber(
  registrationNumber: string,
): boolean {
  return registrationNumber.trim().length > 0;
}
