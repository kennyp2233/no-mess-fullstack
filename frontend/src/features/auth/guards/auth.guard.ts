import { get } from 'svelte/store';
import { authStore } from '../stores/auth.store';

export function isAuthenticated(): boolean {
  const { user, token } = get(authStore);
  return !!user && !!token;
} 