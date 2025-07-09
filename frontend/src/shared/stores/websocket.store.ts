import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { ConnectionStatus } from '../types/websocket.types';
import { websocketService } from '../services/websocket.service';

interface WebSocketState {
  status: ConnectionStatus;
  isConnected: boolean;
  reconnectAttempts: number;
  lastError: string | null;
  connectionHealth: {
    lastPing: Date | null;
    lastPong: Date | null;
    missedPings: number;
    isAlive: boolean;
  };
}

const initialState: WebSocketState = {
  status: ConnectionStatus.DISCONNECTED,
  isConnected: false,
  reconnectAttempts: 0,
  lastError: null,
  connectionHealth: {
    lastPing: null,
    lastPong: null,
    missedPings: 0,
    isAlive: true,
  },
};

function createWebSocketStore() {
  const { subscribe, set, update } = writable<WebSocketState>(initialState);

  // Update store when WebSocket status changes
  function updateStatus() {
    update(state => ({
      ...state,
      status: websocketService.getStatus(),
      isConnected: websocketService.isConnected(),
      reconnectAttempts: websocketService.getReconnectAttempts(),
      connectionHealth: websocketService.getConnectionHealth(),
    }));
  }

  // Set up WebSocket event listeners
  if (browser) {
    websocketService.on('connect', () => {
      update(state => ({
        ...state,
        status: ConnectionStatus.CONNECTED,
        isConnected: true,
        reconnectAttempts: 0,
        lastError: null,
      }));
    });

    websocketService.on('disconnect', () => {
      update(state => ({
        ...state,
        status: ConnectionStatus.DISCONNECTED,
        isConnected: false,
      }));
    });

    websocketService.on('error', (error) => {
      update(state => ({
        ...state,
        status: ConnectionStatus.ERROR,
        lastError: error.message || 'Unknown error',
      }));
    });

    websocketService.on('auth_error', (error) => {
      update(state => ({
        ...state,
        status: ConnectionStatus.ERROR,
        lastError: error.message || 'Authentication error',
      }));
    });

    websocketService.on('connection_error', (error) => {
      update(state => ({
        ...state,
        status: ConnectionStatus.ERROR,
        lastError: error.message || 'Connection error',
      }));
    });

    // Update connection health on ping/pong
    websocketService.on('ping', () => {
      update(state => ({
        ...state,
        connectionHealth: {
          ...state.connectionHealth,
          lastPing: new Date(),
        },
      }));
    });

    websocketService.on('pong', () => {
      update(state => ({
        ...state,
        connectionHealth: {
          ...state.connectionHealth,
          lastPong: new Date(),
          missedPings: 0,
          isAlive: true,
        },
      }));
    });
  }

  return {
    subscribe,
    
    // Connect to WebSocket
    async connect(token?: string) {
      try {
        update(state => ({
          ...state,
          status: ConnectionStatus.CONNECTING,
          lastError: null,
        }));

        await websocketService.connect(token);
        updateStatus();
      } catch (error: any) {
        update(state => ({
          ...state,
          status: ConnectionStatus.ERROR,
          lastError: error.message || 'Connection failed',
        }));
        throw error;
      }
    },

    // Disconnect from WebSocket
    disconnect() {
      websocketService.disconnect();
      updateStatus();
    },

    // Update auth token
    setAuthToken(token: string) {
      websocketService.setAuthToken(token);
    },

    // Clear error
    clearError() {
      update(state => ({
        ...state,
        lastError: null,
      }));
    },

    // Get current status
    getStatus() {
      return websocketService.getStatus();
    },

    // Check if connected
    isConnected() {
      return websocketService.isConnected();
    },
  };
}

export const websocketStore = createWebSocketStore();

// Derived stores for specific states
export const isWebSocketConnected = derived(websocketStore, $store => $store.isConnected);
export const websocketStatus = derived(websocketStore, $store => $store.status);
export const websocketError = derived(websocketStore, $store => $store.lastError);
export const websocketHealth = derived(websocketStore, $store => $store.connectionHealth); 