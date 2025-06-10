"use client";

import { useSession } from "@/lib/auth-client";
import { useStore } from "@nanostores/react";
import { createContext, ReactNode, useContext } from "react";

type SessionContextType = {
  session: any;
  user: any;
  isLoading: boolean;
  error: any;
  isAuthenticated: boolean;
};

const SessionContext = createContext<SessionContextType | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const session = useStore(useSession);
  
  const value: SessionContextType = {
    session,
    user: session?.data?.user,
    isLoading: session?.isPending || false,
    error: session?.error,
    isAuthenticated: !!session?.data?.user,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}

/**
 * Hook for checking if user has specific permissions/roles
 */
export function usePermissions() {
  const { user } = useSessionContext();
  
  const hasRole = (role: string) => {
    return user?.role === role;
  };
  
  const hasAnyRole = (roles: string[]) => {
    return roles.includes(user?.role);
  };
  
  const isAdmin = () => {
    return user?.role === 'admin';
  };
  
  return {
    hasRole,
    hasAnyRole,
    isAdmin,
    userRole: user?.role,
  };
} 