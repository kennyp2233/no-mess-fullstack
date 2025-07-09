import { httpService } from '../../../shared/services/http.service';
import type { Voting } from '../../../shared/types/voting.types';

export const votingService = {
  async getAll(): Promise<Voting[]> {
    // Implementar llamada a backend
    return [];
  },
  async getById(id: string): Promise<Voting | null> {
    // Implementar llamada a backend
    return null;
  },
  async joinRoom(votingId: string): Promise<void> {
    // Implementar lógica WebSocket
  },
  async leaveRoom(votingId: string): Promise<void> {
    // Implementar lógica WebSocket
  },
  async castVote(votingId: string, option: string): Promise<void> {
    // Implementar lógica WebSocket
  },
  async getResults(votingId: string): Promise<any> {
    // Implementar llamada a backend
    return {};
  },
}; 