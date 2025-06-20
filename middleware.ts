import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// Define protected routes patterns
const PROTECTED_ROUTES = [
  '/reports',
  '/transactions', 
  '/dashboard',
  '/settings',
  '/onboarding'
];

// Define public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/reset-password',
  '/api/gmail/webhook', // Gmail push notifications
  '/api/gmail/process-queue', // Public endpoint for cron job
];

// Define auth routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = [
  '/login',
  '/signup'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Middleware only runs for paths matched by config.matcher
  // No need to skip here since matcher already excludes API routes, static files, etc.
  console.log(`[Middleware] Processing: ${pathname}`);

  try {
    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    const isAuthenticated = !!session?.session;
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
    const isAuthRoute = AUTH_ROUTES.includes(pathname);

    console.log(`[Middleware] ${pathname} - Auth: ${isAuthenticated}, Protected: ${isProtectedRoute}`);

    // Redirect home page to reports
    if (pathname === '/') {
      if (isAuthenticated) {
        return NextResponse.redirect(new URL('/reports', request.url));
      } else {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // If user is authenticated and trying to access auth routes, redirect to dashboard
    if (isAuthenticated && isAuthRoute) {
      return NextResponse.redirect(new URL('/reports', request.url));
    }

    // If user is not authenticated and trying to access protected routes, redirect to login
    if (!isAuthenticated && isProtectedRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Allow access to public routes regardless of auth status
    if (isPublicRoute || isAuthenticated) {
      return NextResponse.next();
    }

    // Default: allow access
    return NextResponse.next();

  } catch (error) {
    console.error('[Middleware] Error checking session:', error);
    
    // On error, allow public routes but redirect protected routes to login
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 