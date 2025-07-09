import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { authStore } from '../../features/auth/stores/auth.store';

/**
 * Verifica si el usuario está autenticado
 * @returns true si está autenticado, false en caso contrario
 */
export function isAuthenticated(): boolean {
  if (!browser) return false;
  
  const { user, token } = get(authStore);
  return !!user && !!token;
}

/**
 * Verifica si el usuario está autenticado de forma asíncrona
 * Espera a que el store se inicialice completamente
 * @returns Promise<boolean>
 */
export async function isAuthenticatedAsync(): Promise<boolean> {
  if (!browser) return false;
  
  // Esperar un poco para que el store se inicialice desde localStorage
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const { user, token } = get(authStore);
  console.log('Auth check - user:', user, 'token:', token);
  return !!user && !!token;
}

/**
 * Guard para rutas que requieren autenticación
 * Redirige a /login si no está autenticado
 */
export function requireAuth(): void {
  if (!isAuthenticated()) {
    throw redirect(302, '/login');
  }
}

/**
 * Guard asíncrono para rutas que requieren autenticación
 * Espera a que el store se inicialice antes de verificar
 */
export async function requireAuthAsync(): Promise<void> {
  if (!(await isAuthenticatedAsync())) {
    throw redirect(302, '/login');
  }
}

/**
 * Guard para rutas que requieren NO estar autenticado (como login/register)
 * Redirige a /dashboard si ya está autenticado
 */
export function requireGuest(): void {
  if (isAuthenticated()) {
    throw redirect(302, '/dashboard');
  }
}

/**
 * Guard asíncrono para rutas que requieren NO estar autenticado
 * Espera a que el store se inicialice antes de verificar
 */
export async function requireGuestAsync(): Promise<void> {
  if (await isAuthenticatedAsync()) {
    throw redirect(302, '/dashboard');
  }
}

/**
 * Verifica si el usuario tiene un rol específico
 * @param requiredRole - Rol requerido
 * @returns true si tiene el rol, false en caso contrario
 */
export function hasRole(requiredRole: string): boolean {
  if (!browser) return false;
  
  const { user } = get(authStore);
  return user?.role === requiredRole;
}

/**
 * Guard para rutas que requieren un rol específico
 * Redirige a /dashboard si no tiene el rol requerido
 * @param requiredRole - Rol requerido
 */
export function requireRole(requiredRole: string): void {
  if (!isAuthenticated()) {
    throw redirect(302, '/login');
  }
  
  if (!hasRole(requiredRole)) {
    throw redirect(302, '/dashboard');
  }
} 