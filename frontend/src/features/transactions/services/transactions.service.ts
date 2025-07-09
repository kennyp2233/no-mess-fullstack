import { httpService } from '../../../shared/services/http.service';
import type { Transaction } from '../../../shared/types/transaction.types';

export const transactionsService = {
  async getAll(): Promise<Transaction[]> {
    // Implementar llamada a backend
    return [];
  },
  async getById(id: string): Promise<Transaction | null> {
    // Implementar llamada a backend
    return null;
  },
  async create(data: Partial<Transaction>): Promise<Transaction> {
    // Implementar llamada a backend
    return {} as Transaction;
  },
  async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    // Implementar llamada a backend
    return {} as Transaction;
  },
  async delete(id: string): Promise<void> {
    // Implementar llamada a backend
  },
  async getBalance(): Promise<any> {
    // Implementar llamada a backend
    return {};
  },
  async getCategories(): Promise<string[]> {
    // Implementar llamada a backend
    return [];
  },
  async getTypes(): Promise<string[]> {
    // Implementar llamada a backend
    return [];
  },
  async getByHouse(houseId: string): Promise<Transaction[]> {
    // Implementar llamada a backend
    return [];
  },
  async getByDateRange(start: string, end: string): Promise<Transaction[]> {
    // Implementar llamada a backend
    return [];
  },
  async uploadReceipt(transactionId: string, file: File): Promise<any> {
    // Implementar integración con file upload
    return {};
  },
}; 