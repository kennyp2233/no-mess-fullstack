// Enums
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export enum TransactionCategory {
  ALIQUOT = 'ALIQUOT',
  EXTRAORDINARY_FEE = 'EXTRAORDINARY_FEE',
  FINE = 'FINE',
  MAINTENANCE = 'MAINTENANCE',
  PROJECT = 'PROJECT',
  DONATION = 'DONATION',
  OTHER = 'OTHER'
}

// Base Transaction interface
export interface Transaction {
  id: string;
  title: string;
  description?: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: string;
  filePath?: string;
  createdAt: string;
  updatedAt: string;
  
  // Foreign keys
  userId: string;
  houseId: string;
  accountId: string;
  projectId?: string;
  
  // Relations
  user: UserResponse;
  house: House;
  account: Account;
  project?: Project;
}

// Transaction creation
export interface CreateTransactionRequest {
  title: string;
  description?: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  date: string;
  accountId: string;
  projectId?: string;
  file?: File;
}

// Transaction update
export interface UpdateTransactionRequest {
  title?: string;
  description?: string;
  amount?: number;
  type?: TransactionType;
  category?: TransactionCategory;
  date?: string;
  accountId?: string;
  projectId?: string;
  file?: File;
}

// Transaction query
export interface TransactionQuery {
  page?: number;
  limit?: number;
  type?: TransactionType;
  category?: TransactionCategory;
  startDate?: string;
  endDate?: string;
  houseId?: string;
  accountId?: string;
  projectId?: string;
}

// Account interface
export interface Account {
  id: string;
  name: string;
  description?: string;
  balance: number;
  houseId: string;
  createdAt: string;
  updatedAt: string;
}

// Project interface
export interface Project {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  houseId: string;
  createdAt: string;
  updatedAt: string;
}

export enum ProjectStatus {
  PROPOSED = 'PROPOSED',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Import types from other files
import type { UserResponse } from './user.types';
import type { House } from './house.types'; 