import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { authStore } from '../../features/auth/stores/auth.store';
import { Role } from '../types/user.types';

/**
 * Verifica si el usuario tiene un rol específico
 * @param requiredRole - Rol requerido
 * @returns true si tiene el rol, false en caso contrario
 */
export function hasRole(requiredRole: Role): boolean {
  if (!browser) return false;
  
  const { user } = get(authStore);
  return user?.role === requiredRole;
}

/**
 * Verifica si el usuario tiene al menos uno de los roles especificados
 * @param requiredRoles - Roles requeridos
 * @returns true si tiene al menos uno de los roles, false en caso contrario
 */
export function hasAnyRole(requiredRoles: Role[]): boolean {
  if (!browser) return false;
  
  const { user } = get(authStore);
  return requiredRoles.includes(user?.role as Role);
}

/**
 * Verifica si el usuario tiene todos los roles especificados
 * @param requiredRoles - Roles requeridos
 * @returns true si tiene todos los roles, false en caso contrario
 */
export function hasAllRoles(requiredRoles: Role[]): boolean {
  if (!browser) return false;
  
  const { user } = get(authStore);
  return requiredRoles.every(role => user?.role === role);
}

/**
 * Guard para rutas que requieren un rol específico
 * Redirige a /dashboard si no tiene el rol requerido
 * @param requiredRole - Rol requerido
 */
export function requireRole(requiredRole: Role): void {
  if (!hasRole(requiredRole)) {
    throw redirect(302, '/dashboard');
  }
}

/**
 * Guard para rutas que requieren al menos uno de los roles especificados
 * Redirige a /dashboard si no tiene ninguno de los roles requeridos
 * @param requiredRoles - Roles requeridos
 */
export function requireAnyRole(requiredRoles: Role[]): void {
  if (!hasAnyRole(requiredRoles)) {
    throw redirect(302, '/dashboard');
  }
}

/**
 * Guard para rutas que requieren todos los roles especificados
 * Redirige a /dashboard si no tiene todos los roles requeridos
 * @param requiredRoles - Roles requeridos
 */
export function requireAllRoles(requiredRoles: Role[]): void {
  if (!hasAllRoles(requiredRoles)) {
    throw redirect(302, '/dashboard');
  }
}

/**
 * Verifica si el usuario es administrador
 * @returns true si es admin, false en caso contrario
 */
export function isAdmin(): boolean {
  return hasRole(Role.ADMIN);
}

/**
 * Verifica si el usuario es presidente o admin
 * @returns true si es presidente o admin, false en caso contrario
 */
export function isPresidentOrAdmin(): boolean {
  return hasAnyRole([Role.PRESIDENT, Role.ADMIN]);
}

/**
 * Guard para rutas que requieren ser administrador
 * Redirige a /dashboard si no es admin
 */
export function requireAdmin(): void {
  requireRole(Role.ADMIN);
}

/**
 * Guard para rutas que requieren ser presidente o admin
 * Redirige a /dashboard si no es presidente ni admin
 */
export function requirePresidentOrAdmin(): void {
  requireAnyRole([Role.PRESIDENT, Role.ADMIN]);
} 