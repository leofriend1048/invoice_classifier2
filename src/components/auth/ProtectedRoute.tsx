"use client";

import { ComponentType } from "react";
import { AuthWrapper } from "./AuthWrapper";

interface ProtectedRouteOptions {
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * Higher-order component that wraps a page component to make it protected
 * 
 * @example
 * ```tsx
 * export default withAuth(MyPage, { redirectTo: "/login" });
 * ```
 */
export function withAuth<P extends object>(
  Component: ComponentType<P>, 
  options: ProtectedRouteOptions = {}
) {
  const AuthenticatedComponent = (props: P) => (
    <AuthWrapper requireAuth={true} {...options}>
      <Component {...props} />
    </AuthWrapper>
  );

  // Preserve display name for debugging
  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;

  return AuthenticatedComponent;
}

/**
 * Higher-order component that wraps a page component to make it public only
 * (redirects authenticated users)
 * 
 * @example
 * ```tsx
 * export default withGuest(LoginPage, { redirectTo: "/dashboard" });
 * ```
 */
export function withGuest<P extends object>(
  Component: ComponentType<P>,
  options: { redirectTo?: string } = {}
) {
  const GuestOnlyComponent = (props: P) => (
    <AuthWrapper requireAuth={false} redirectTo={options.redirectTo || "/reports"}>
      <Component {...props} />
    </AuthWrapper>
  );

  // Preserve display name for debugging
  GuestOnlyComponent.displayName = `withGuest(${Component.displayName || Component.name})`;

  return GuestOnlyComponent;
} 