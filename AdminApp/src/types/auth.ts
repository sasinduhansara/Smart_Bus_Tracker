export interface AdminProfile {
  email: string;
  role: 'admin' | string;
}

export interface AdminSession {
  accessToken: string;
  admin: AdminProfile;
}
