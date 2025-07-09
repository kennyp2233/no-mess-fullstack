import { Socket } from 'socket.io';
import { WebSocketUser } from '../../src/shared/types/websocket.types';

// Test data factories
export class WebSocketTestDataFactory {
    static createMockUser(overrides: Partial<WebSocketUser> = {}): WebSocketUser {
        return {
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            role: 'USER',
            ...overrides,
        };
    }

    static createMockToken(userId: string = 'test-user-id'): string {
        // Mock JWT token for testing
        return `mock-jwt-token-${userId}`;
    }

    static createTestMessage(data: any = {}): any {
        return {
            message: 'Test message',
            timestamp: new Date().toISOString(),
            ...data,
        };
    }

    static createVoteData(overrides: any = {}): any {
        return {
            votingId: 'test-voting-id',
            proposalId: 'test-proposal-id',
            vote: 'APPROVE',
            comment: 'Test vote comment',
            ...overrides,
        };
    }

    static createJoinVotingData(overrides: any = {}): any {
        return {
            votingId: 'test-voting-id',
            ...overrides,
        };
    }
}

// Mock WebSocket client
export class MockWebSocketClient {
    public id: string;
    public connected: boolean = false;
    public events: Map<string, any[]> = new Map();
    public rooms: Set<string> = new Set();
    public data: any = {};
    public user?: WebSocketUser;

    constructor(id: string = `mock-client-${Date.now()}`) {
        this.id = id;
    }

    emit(event: string, data: any): void {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(data);
    }

    join(room: string): void {
        this.rooms.add(room);
    }

    leave(room: string): void {
        this.rooms.delete(room);
    }

    disconnect(): void {
        this.connected = false;
    }

    getEventCount(event: string): number {
        return this.events.get(event)?.length || 0;
    }

    getLastEvent(event: string): any {
        const events = this.events.get(event);
        return events ? events[events.length - 1] : null;
    }

    getAllEvents(event: string): any[] {
        return this.events.get(event) || [];
    }

    clearEvents(): void {
        this.events.clear();
    }

    isInRoom(room: string): boolean {
        return this.rooms.has(room);
    }

    getRooms(): string[] {
        return Array.from(this.rooms);
    }
}

// Mock Socket.IO Server
export class MockSocketIOServer {
    public sockets: Map<string, MockWebSocketClient> = new Map();
    public rooms: Map<string, Set<string>> = new Map();

    toSocket(socketId: string): MockSocketEmitter {
        return new MockSocketEmitter(socketId, this);
    }

    toRoom(room: string): MockRoomEmitter {
        return new MockRoomEmitter(room, this);
    }

    except(socketId: string): MockSocketEmitter {
        return new MockSocketEmitter(socketId, this, true);
    }

    emit(event: string, data: any): void {
        // Broadcast to all sockets
        this.sockets.forEach(socket => {
            socket.emit(event, data);
        });
    }

    addSocket(socket: MockWebSocketClient): void {
        this.sockets.set(socket.id, socket);
    }

    removeSocket(socketId: string): void {
        this.sockets.delete(socketId);
    }

    getSocket(socketId: string): MockWebSocketClient | undefined {
        return this.sockets.get(socketId);
    }
}

class MockSocketEmitter {
    constructor(
        private socketId: string,
        private server: MockSocketIOServer,
        private exclude: boolean = false
    ) {}

    emit(event: string, data: any): void {
        if (this.exclude) {
            // Emit to all sockets except the specified one
            this.server.sockets.forEach((socket, id) => {
                if (id !== this.socketId) {
                    socket.emit(event, data);
                }
            });
        } else {
            // Emit to specific socket
            const socket = this.server.sockets.get(this.socketId);
            if (socket) {
                socket.emit(event, data);
            }
        }
    }
}

class MockRoomEmitter {
    constructor(
        private room: string,
        private server: MockSocketIOServer
    ) {}

    emit(event: string, data: any): void {
        const roomSockets = this.server.rooms.get(this.room);
        if (roomSockets) {
            roomSockets.forEach(socketId => {
                const socket = this.server.sockets.get(socketId);
                if (socket) {
                    socket.emit(event, data);
                }
            });
        }
    }

    except(socketId: string): MockRoomEmitter {
        // Create a new emitter that excludes the specified socket
        const emitter = new MockRoomEmitter(this.room, this.server);
        // This is a simplified implementation
        return emitter;
    }
}

// Assertion helpers
export class WebSocketAssertions {
    static expectEvent(client: MockWebSocketClient, event: string, expectedData?: any): void {
        const events = client.getAllEvents(event);
        expect(events.length).toBeGreaterThan(0);
        
        if (expectedData) {
            const lastEvent = client.getLastEvent(event);
            expect(lastEvent).toMatchObject(expectedData);
        }
    }

    static expectNoEvent(client: MockWebSocketClient, event: string): void {
        const events = client.getAllEvents(event);
        expect(events.length).toBe(0);
    }

    static expectEventCount(client: MockWebSocketClient, event: string, count: number): void {
        const events = client.getAllEvents(event);
        expect(events.length).toBe(count);
    }

    static expectSuccessResponse(client: MockWebSocketClient, event: string): void {
        const lastEvent = client.getLastEvent(event);
        expect(lastEvent).toBeDefined();
        expect(lastEvent.success).toBe(true);
    }

    static expectErrorResponse(client: MockWebSocketClient, event: string, errorCode?: string): void {
        const lastEvent = client.getLastEvent(event);
        expect(lastEvent).toBeDefined();
        expect(lastEvent.success).toBe(false);
        
        if (errorCode) {
            expect(lastEvent.error.code).toBe(errorCode);
        }
    }

    static expectUserConnected(client: MockWebSocketClient, user: WebSocketUser): void {
        const lastEvent = client.getLastEvent('user_connected');
        expect(lastEvent).toBeDefined();
        expect(lastEvent.success).toBe(true);
        expect(lastEvent.data.user).toMatchObject(user);
    }

    static expectVotingRoomJoined(client: MockWebSocketClient, votingId: string): void {
        const lastEvent = client.getLastEvent('voting_joined');
        expect(lastEvent).toBeDefined();
        expect(lastEvent.success).toBe(true);
        expect(lastEvent.data.votingId).toBe(votingId);
    }

    static expectVoteCast(client: MockWebSocketClient, votingId: string, proposalId: string): void {
        const lastEvent = client.getLastEvent('vote_cast');
        expect(lastEvent).toBeDefined();
        expect(lastEvent.success).toBe(true);
        expect(lastEvent.data.votingId).toBe(votingId);
        expect(lastEvent.data.proposalId).toBe(proposalId);
    }
}

// Test utilities
export class WebSocketTestUtils {
    static createMockSocket(overrides: any = {}): any {
        return {
            id: `mock-socket-${Date.now()}`,
            handshake: {
                auth: {},
                headers: {},
                query: {},
            },
            data: {},
            emit: jest.fn(),
            join: jest.fn(),
            leave: jest.fn(),
            disconnect: jest.fn(),
            broadcast: {
                emit: jest.fn(),
            },
            ...overrides,
        };
    }

    static createMockServer(): any {
        return {
            sockets: {
                sockets: new Map(),
            },
            to: jest.fn().mockReturnValue({
                emit: jest.fn(),
                except: jest.fn().mockReturnValue({
                    emit: jest.fn(),
                }),
            }),
            emit: jest.fn(),
        };
    }

    static waitForEvent(client: MockWebSocketClient, event: string, timeout: number = 1000): Promise<any> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkEvent = () => {
                const events = client.getAllEvents(event);
                if (events.length > 0) {
                    resolve(events[events.length - 1]);
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout waiting for event: ${event}`));
                    return;
                }
                
                setTimeout(checkEvent, 10);
            };
            
            checkEvent();
        });
    }

    static async waitForMultipleEvents(
        client: MockWebSocketClient, 
        events: string[], 
        timeout: number = 1000
    ): Promise<Map<string, any>> {
        const results = new Map<string, any>();
        const promises = events.map(event => 
            this.waitForEvent(client, event, timeout)
                .then(data => results.set(event, data))
        );
        
        await Promise.all(promises);
        return results;
    }
} 