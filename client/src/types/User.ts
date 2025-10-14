// client/src/types/User.ts
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DRIVER = 'driver',
  VIEWER = 'viewer'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId: string;
  fullName: string;
  isActive: boolean;
  isOpsTeam: boolean;
  isSuperUser: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}
