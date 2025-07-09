// Enums
export enum Role {
  ADMIN = 'ADMIN',
  PRESIDENT = 'PRESIDENT',
  TREASURER = 'TREASURER',
  SECRETARY = 'SECRETARY',
  RESIDENT = 'RESIDENT'
}

// Base User interface
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

// User without password for API responses
export interface UserResponse extends Omit<User, 'password'> {}

// User creation
export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  phone?: string;
  role?: Role;
}

// User update
export interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string;
  role?: Role;
}

// Authentication
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserResponse;
  token: string;
}

export interface RegisterRequest extends CreateUserRequest {}

export interface RegisterResponse {
  user: UserResponse;
  token: string;
}

// Import House type
import type { House } from './house.types';

// User with house relationship
export interface HouseUser {
  id: string;
  role: Role;
  userId: string;
  houseId: string;
  user: UserResponse;
  house: House;
}

// Current user context
export interface CurrentUser extends UserResponse {
  houses: HouseUser[];
} 