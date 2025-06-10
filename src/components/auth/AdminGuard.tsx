"use client";

import { Loader2, ShieldX } from "lucide-react";
import { ReactNode } from "react";
import { usePermissions, useSessionContext } from "./SessionProvider";

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

export function AdminGuard({ children, fallback, loading }: AdminGuardProps) {
  const { isLoading, isAuthenticated } = useSessionContext();
  const { isAdmin } = usePermissions();

  // Show loading state
  if (isLoading) {
    return loading || <AdminLoadingFallback />;
  }

  // Check if user is authenticated and is admin
  if (!isAuthenticated || !isAdmin()) {
    return fallback || <AdminAccessDenied />;
  }

  return <>{children}</>;
}

function AdminLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Verifying admin access...
        </p>
      </div>
    </div>
  );
}

function AdminAccessDenied() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <ShieldX className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Access Denied
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You need admin privileges to access this content.
        </p>
      </div>
    </div>
  );
}

/**
 * HOC for wrapping components that require admin access
 */
export function withAdminGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: { fallback?: ReactNode; loading?: ReactNode } = {}
) {
  const AdminProtectedComponent = (props: P) => (
    <AdminGuard fallback={options.fallback} loading={options.loading}>
      <Component {...props} />
    </AdminGuard>
  );

  AdminProtectedComponent.displayName = `withAdminGuard(${Component.displayName || Component.name})`;

  return AdminProtectedComponent;
} 