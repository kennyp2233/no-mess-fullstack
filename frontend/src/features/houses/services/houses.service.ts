import { httpService } from '../../../shared/services/http.service';
import type { House } from '../../../shared/types/house.types';

export const housesService = {
  async getAll(): Promise<House[]> {
    // Implementar llamada a backend
    return [];
  },
  async getById(id: string): Promise<House | null> {
    // Implementar llamada a backend
    return null;
  },
  async create(data: Partial<House>): Promise<House> {
    // Implementar llamada a backend
    return {} as House;
  },
  async update(id: string, data: Partial<House>): Promise<House> {
    // Implementar llamada a backend
    return {} as House;
  },
  async delete(id: string): Promise<void> {
    // Implementar llamada a backend
  },
  async getBalance(id: string): Promise<any> {
    // Implementar llamada a backend
    return {} as any;
  },
  async getDebtors(id: string): Promise<any[]> {
    // Implementar llamada a backend
    return [];
  },
}; 