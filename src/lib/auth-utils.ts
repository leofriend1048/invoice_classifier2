import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Server-side function to get the current session
 * Use this in server components, API routes, and middleware
 */
export async function getServerSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch (error) {
    console.error("[Auth Utils] Error getting server session:", error);
    return null;
  }
}

/**
 * Server-side function to get the current user
 */
export async function getServerUser() {
  const session = await getServerSession();
  return session?.user || null;
}

/**
 * Server-side function to check if user is authenticated
 */
export async function isAuthenticated() {
  const session = await getServerSession();
  return !!session?.session;
}

/**
 * Server-side function to check if user has a specific role
 */
export async function hasRole(role: string) {
  const user = await getServerUser();
  return user?.role === role;
}

/**
 * Server-side function to check if user has any of the specified roles
 */
export async function hasAnyRole(roles: string[]) {
  const user = await getServerUser();
  return user?.role && roles.includes(user.role);
}

/**
 * Server-side function to check if user is admin
 */
export async function isAdmin() {
  return await hasRole('admin');
}

/**
 * Server-side function to require authentication
 * Throws an error if user is not authenticated
 */
export async function requireAuth() {
  const session = await getServerSession();
  if (!session?.session) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Server-side function to require specific role
 * Throws an error if user doesn't have the required role
 */
export async function requireRole(role: string) {
  const user = await getServerUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  if (user.role !== role) {
    throw new Error(`Role '${role}' required`);
  }
  return user;
}

/**
 * Server-side function to require admin role
 */
export async function requireAdmin() {
  return await requireRole('admin');
}

/**
 * Client-side session utilities
 */
export const clientAuth = {
  /**
   * Check if current user has specific role (client-side)
   */
  hasRole: (user: any, role: string) => {
    return user?.role === role;
  },

  /**
   * Check if current user has any of the specified roles (client-side)
   */
  hasAnyRole: (user: any, roles: string[]) => {
    return user?.role && roles.includes(user.role);
  },

  /**
   * Check if current user is admin (client-side)
   */
  isAdmin: (user: any) => {
    return user?.role === 'admin';
  },

  /**
   * Check if user is authenticated (client-side)
   */
  isAuthenticated: (user: any) => {
    return !!user;
  },
}; 