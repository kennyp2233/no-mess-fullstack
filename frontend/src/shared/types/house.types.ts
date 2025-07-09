// Base House interface
export interface House {
  id: string;
  name: string;
  description?: string;
  address?: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

// House creation
export interface CreateHouseRequest {
  name: string;
  description?: string;
  address?: string;
}

// House update
export interface UpdateHouseRequest {
  name?: string;
  description?: string;
  address?: string;
}

// House with users
export interface HouseWithUsers extends House {
  users: HouseUser[];
}

// House assignment
export interface AssignUserToHouseRequest {
  userId: string;
  houseId: string;
  role?: Role;
}

// House query
export interface HouseQuery {
  page?: number;
  limit?: number;
  search?: string;
}

// Paginated response
export interface HousePaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Import types from other files
import type { Role } from './user.types';
import type { HouseUser } from './user.types'; 