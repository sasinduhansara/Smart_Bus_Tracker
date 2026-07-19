export function normalizeMobile(mobile: string): string {
  const cleaned = mobile.trim().replace(/[\s-]/g, '');

  if (cleaned.startsWith('+94')) {
    return cleaned.slice(1);
  }

  if (cleaned.startsWith('0')) {
    return `94${cleaned.slice(1)}`;
  }

  return cleaned.startsWith('94') ? cleaned : `94${cleaned}`;
}

export function isValidMobile(mobile: string): boolean {
  return /^947\d{8}$/.test(normalizeMobile(mobile));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

export function isValidNIC(nic: string): boolean {
  const normalizedNIC = nic.trim().toUpperCase();

  return /^\d{9}[VX]$/.test(normalizedNIC) || /^\d{12}$/.test(normalizedNIC);
}

export function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
  );
}

export function isTodayOrFutureDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return false;
  }

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
