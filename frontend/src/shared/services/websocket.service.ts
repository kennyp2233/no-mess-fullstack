import { io, Socket } from 'socket.io-client';
import { browser } from '$app/environment';
import { ConnectionStatus } from '../types/websocket.types';
import type { 
  WebSocketUser, 
  WebSocketEventMap, 
  WebSocketConfig,
  ConnectionHealth,
  WebSocketResponse 
} from '../types/websocket.types';

class WebSocketService {
  private socket: Socket | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: number | null = null;
  private eventListeners = new Map<string, Set<Function>>();
  private connectionHealth: ConnectionHealth = {
    lastPing: new Date(),
    lastPong: null,
    missedPings: 0,
    isAlive: true,
  };

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      authToken: config.authToken,
      autoConnect: config.autoConnect ?? false,
      reconnectionAttempts: config.reconnectionAttempts ?? 5,
      reconnectionDelay: config.reconnectionDelay ?? 1000,
      heartbeatInterval: config.heartbeatInterval ?? 30000, // 30 seconds
    };

    this.maxReconnectAttempts = this.config.reconnectionAttempts ?? 5;
    this.reconnectDelay = this.config.reconnectionDelay ?? 1000;

    if (this.config.autoConnect && browser) {
      this.connect();
    }
  }

  // ===========================================
  // CONNECTION MANAGEMENT
  // ===========================================

  async connect(token?: string): Promise<void> {
    if (!browser) {
      console.warn('WebSocket connection attempted on server side');
      return;
    }

    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.setStatus(ConnectionStatus.CONNECTING);

      const authToken = token || this.config.authToken;
      if (!authToken) {
        throw new Error('No authentication token provided');
      }

      // Create socket connection with authentication
      this.socket = io(this.config.url, {
        transports: ['websocket', 'polling'],
        auth: {
          token: authToken,
        },
        autoConnect: true,
        reconnection: false, // We'll handle reconnection manually
      });

      this.setupEventListeners();
      this.setupHeartbeat();

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // 10 second timeout

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          this.setStatus(ConnectionStatus.CONNECTED);
          this.reconnectAttempts = 0;
          console.log('WebSocket connected successfully');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          this.setStatus(ConnectionStatus.ERROR);
          console.error('WebSocket connection error:', error);
          reject(error);
        });

        this.socket.on('auth_error', (error) => {
          clearTimeout(timeout);
          this.setStatus(ConnectionStatus.ERROR);
          console.error('WebSocket authentication error:', error);
          reject(new Error(error.message || 'Authentication failed'));
        });
      });

    } catch (error) {
      this.setStatus(ConnectionStatus.ERROR);
      console.error('Error connecting to WebSocket:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.reconnectAttempts = 0;
    console.log('WebSocket disconnected');
  }

  // ===========================================
  // EVENT MANAGEMENT
  // ===========================================

  on<T extends keyof WebSocketEventMap>(event: T, callback: WebSocketEventMap[T]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Also set up socket.io listener if socket exists
    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  off<T extends keyof WebSocketEventMap>(event: T, callback: WebSocketEventMap[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }

    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit event '${event}': WebSocket not connected`);
    }
  }

  // ===========================================
  // RECONNECTION LOGIC
  // ===========================================

  private async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus(ConnectionStatus.ERROR);
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.setStatus(ConnectionStatus.RECONNECTING);

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    try {
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay * this.reconnectAttempts));
      await this.connect();
    } catch (error) {
      console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      this.attemptReconnection();
    }
  }

  // ===========================================
  // HEARTBEAT MANAGEMENT
  // ===========================================

  private setupHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.connectionHealth.lastPing = new Date();
        this.connectionHealth.missedPings++;
        
        // Mark as potentially dead if too many pings missed
        if (this.connectionHealth.missedPings >= 3) {
          this.connectionHealth.isAlive = false;
          console.warn('WebSocket connection appears to be dead, attempting reconnection');
          this.attemptReconnection();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private handlePong(): void {
    this.connectionHealth.lastPong = new Date();
    this.connectionHealth.missedPings = 0;
    this.connectionHealth.isAlive = true;
  }

  // ===========================================
  // EVENT LISTENERS SETUP
  // ===========================================

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.setStatus(ConnectionStatus.CONNECTED);
      this.reconnectAttempts = 0;
      this.connectionHealth.isAlive = true;
      this.emitEvent('connect');
    });

    this.socket.on('disconnect', (reason) => {
      this.setStatus(ConnectionStatus.DISCONNECTED);
      console.log('WebSocket disconnected:', reason);
      this.emitEvent('disconnect');

      // Attempt reconnection if not manually disconnected
      if (reason !== 'io client disconnect') {
        this.attemptReconnection();
      }
    });

    // User events
    this.socket.on('user_connected', (user: WebSocketUser) => {
      console.log('User connected:', user);
      this.emitEvent('user_connected', user);
    });

    this.socket.on('user_disconnected', (userId: string) => {
      console.log('User disconnected:', userId);
      this.emitEvent('user_disconnected', userId);
    });

    // Ping/Pong events
    this.socket.on('ping', () => {
      console.debug('Received ping from server');
      this.emitEvent('ping');
      // Respond with pong
      this.emit('pong');
    });

    this.socket.on('pong', () => {
      console.debug('Received pong from server');
      this.handlePong();
      this.emitEvent('pong');
    });

    // Error events
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.setStatus(ConnectionStatus.ERROR);
      this.emitEvent('error', error);
    });

    this.socket.on('auth_error', (error) => {
      console.error('WebSocket authentication error:', error);
      this.setStatus(ConnectionStatus.ERROR);
      this.emitEvent('auth_error', error);
    });

    this.socket.on('connection_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.setStatus(ConnectionStatus.ERROR);
      this.emitEvent('connection_error', error);
    });

    this.socket.on('rate_limit_error', (error) => {
      console.error('WebSocket rate limit error:', error);
      this.emitEvent('rate_limit_error', error);
    });

    this.socket.on('validation_error', (error) => {
      console.error('WebSocket validation error:', error);
      this.emitEvent('validation_error', error);
    });

    // Set up existing event listeners
    for (const [event, listeners] of this.eventListeners.entries()) {
      for (const listener of listeners) {
        this.socket.on(event, listener as any);
      }
    }
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    console.log(`WebSocket status changed to: ${status}`);
  }

  private emitEvent(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for '${event}':`, error);
        }
      }
    }
  }

  // ===========================================
  // PUBLIC GETTERS
  // ===========================================

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getConnectionHealth(): ConnectionHealth {
    return { ...this.connectionHealth };
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // ===========================================
  // CONFIGURATION
  // ===========================================

  updateConfig(newConfig: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.authToken && this.socket?.connected) {
      // Reconnect with new token
      this.disconnect();
      this.connect(newConfig.authToken);
    }
  }

  setAuthToken(token: string): void {
    this.config.authToken = token;
    if (this.socket?.connected) {
      this.disconnect();
      this.connect(token);
    }
  }

  // ===========================================
  // TEST METHODS
  // ===========================================

  // Send test message to server
  sendTestMessage(message: string): void {
    if (this.socket?.connected) {
      this.socket.emit('test_message', { message, timestamp: new Date().toISOString() });
    } else {
      console.warn('Cannot send test message: WebSocket not connected');
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService({
  url: import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000',
  autoConnect: false, // Will be controlled by auth store
});

export default websocketService; 