import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { UserResponse, LoginResponse } from '../../../shared/types';
import { authService } from '../services/auth.service';
import { websocketStore } from '../../../shared/stores/websocket.store';

interface AuthState {
  user: UserResponse | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  // Cargar estado desde localStorage
  if (browser) {
    const stored = localStorage.getItem('auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.user && parsed.token) {
          set({ ...initialState, ...parsed, loading: false, error: null });
          
          // Connect to WebSocket if we have a valid token
          setTimeout(async () => {
            try {
              await websocketStore.connect(parsed.token);
            } catch (error) {
              console.warn('Failed to connect to WebSocket on app load:', error);
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error parsing stored auth data:', error);
        localStorage.removeItem('auth');
      }
    }
  }

  function persist(state: AuthState) {
    if (browser) {
      const dataToStore = { user: state.user, token: state.token };
      console.log('AuthStore: Persisting to localStorage:', dataToStore);
      localStorage.setItem('auth', JSON.stringify(dataToStore));
    }
  }

  return {
    subscribe,
    async login(email: string, password: string) {
      update(s => ({ ...s, loading: true, error: null }));
      try {
        const res = await authService.login({ email, password });
        console.log('AuthStore: Login successful, storing data:', res);
        update(s => ({ ...s, user: res.user, token: res.token, loading: false, error: null }));
        persist({ user: res.user, token: res.token, loading: false, error: null });
        
        // Connect to WebSocket after successful login
        if (browser && res.token) {
          try {
            await websocketStore.connect(res.token);
          } catch (error) {
            console.warn('Failed to connect to WebSocket after login:', error);
          }
        }
        
        return res;
      } catch (e: any) {
        update(s => ({ ...s, loading: false, error: e?.message || 'Error de autenticación' }));
        throw e;
      }
    },
    async logout() {
      // Disconnect from WebSocket before logout
      if (browser) {
        websocketStore.disconnect();
      }
      
      await authService.logout();
      set(initialState);
      if (browser) localStorage.removeItem('auth');
    },
    setUser(user: UserResponse | null) {
      update(s => ({ ...s, user }));
      if (browser) {
        const stored = localStorage.getItem('auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem('auth', JSON.stringify({ ...parsed, user }));
        }
      }
    },
    setToken(token: string | null) {
      update(s => ({ ...s, token }));
      if (browser) {
        const stored = localStorage.getItem('auth');
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem('auth', JSON.stringify({ ...parsed, token }));
        }
      }
    },
    clear() {
      set(initialState);
      if (browser) localStorage.removeItem('auth');
    },
  };
}

export const authStore = createAuthStore();
