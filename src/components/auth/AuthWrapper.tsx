"use client";

import { useSession } from "@/lib/auth-client";
import { useStore } from "@nanostores/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

interface AuthWrapperProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: ReactNode;
}

export function AuthWrapper({ 
  children, 
  requireAuth = true, 
  redirectTo = "/login",
  fallback 
}: AuthWrapperProps) {
  const session = useStore(useSession);
  const router = useRouter();
  
  const isLoading = session?.isPending;
  const error = session?.error;
  const user = session?.data?.user;

  useEffect(() => {
    if (!isLoading && requireAuth) {
      if (error) {
        console.error("[AuthWrapper] Session error:", error);
        router.push(redirectTo);
        return;
      }

      if (!user) {
        // Store the current path for redirect after login
        const currentPath = window.location.pathname;
        const redirectUrl = new URL(redirectTo, window.location.origin);
        if (currentPath !== "/" && currentPath !== redirectTo) {
          redirectUrl.searchParams.set("redirectTo", currentPath);
        }
        router.push(redirectUrl.toString());
        return;
      }
    }
  }, [user, isLoading, error, requireAuth, router, redirectTo]);

  // Show loading state while checking authentication
  if (isLoading) {
    return fallback || <AuthLoadingFallback />;
  }

  // Show error state
  if (error) {
    return <AuthErrorFallback error={error} />;
  }

  // If auth is required but user is not authenticated, show loading
  // (redirect will happen in useEffect)
  if (requireAuth && !user) {
    return fallback || <AuthLoadingFallback />;
  }

  // Render children if authenticated or auth not required
  return <>{children}</>;
}

function AuthLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Loading...
        </p>
      </div>
    </div>
  );
}

function AuthErrorFallback({ error }: { error: any }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="text-red-500">
          <svg className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          Authentication Error
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {error.message || "Unable to verify authentication"}
        </p>
        <div className="mt-4">
          <button
            onClick={() => window.location.href = "/login"}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
} 