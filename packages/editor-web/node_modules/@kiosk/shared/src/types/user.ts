// packages/shared/src/types/user.ts

export enum UserRole {
  Admin = 'admin',
  User = 'user'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  organizationId?: string;
}

export interface CreateOrganizationInput {
  name: string;
  ownerUserId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: Omit<User, 'passwordHash'>;
  error?: string;
}
