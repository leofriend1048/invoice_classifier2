# Authentication System Documentation

## Overview

This application uses **Better Auth** with a comprehensive protection system that includes both server-side and client-side authentication checks.

## Components

### 1. Middleware Protection (`middleware.ts`)

Server-side route protection that:

- Redirects unauthenticated users from protected routes to `/login`
- Redirects authenticated users from auth pages to `/reports`
- Redirects home page (`/`) to `/reports` for authenticated users, `/login` for unauthenticated users
- Preserves the original URL for post-login redirects
- Protects routes: `/reports`, `/transactions`, `/dashboard`, `/settings`, `/onboarding`

### 2. AuthWrapper (`src/components/auth/AuthWrapper.tsx`)

Client-side authentication wrapper that:

- Checks session state and redirects if needed
- Shows loading states during authentication checks
- Handles authentication errors gracefully
- Supports both protected and public route modes

```tsx
// Protected route usage
<AuthWrapper requireAuth={true}>
  <YourComponent />
</AuthWrapper>

// Public route usage (redirects authenticated users)
<AuthWrapper requireAuth={false}>
  <LoginForm />
</AuthWrapper>
```

### 3. Higher-Order Components (`src/components/auth/ProtectedRoute.tsx`)

Convenient HOCs for page-level protection:

```tsx
// Protected page
export default withAuth(MyPage, { redirectTo: "/login" })

// Guest-only page
export default withGuest(LoginPage, { redirectTo: "/dashboard" })
```

### 4. Session Provider (`src/components/auth/SessionProvider.tsx`)

React context for session management:

```tsx
import {
  useSessionContext,
  usePermissions,
} from "@/components/auth/SessionProvider"

function MyComponent() {
  const { user, isAuthenticated, isLoading } = useSessionContext()
  const { hasRole, isAdmin } = usePermissions()

  if (isLoading) return <Loading />
  if (!isAuthenticated) return <NotAuthenticated />

  return <div>Hello {user.name}</div>
}
```

### 5. Admin Guard (`src/components/auth/AdminGuard.tsx`)

Component for protecting admin-only content:

```tsx
import { AdminGuard, withAdminGuard } from "@/components/auth/AdminGuard"

// Component usage
;<AdminGuard>
  <AdminOnlyContent />
</AdminGuard>

// HOC usage
export default withAdminGuard(AdminPage)
```

### 6. Auth Utilities (`src/lib/auth-utils.ts`)

Server-side helpers for API routes and server components:

```tsx
import { getServerSession, requireAuth, hasRole } from "@/lib/auth-utils"

// In API routes
export async function GET() {
  const session = await requireAuth() // Throws if not authenticated
  // ... handle authenticated request
}

// In server components
export default async function MyPage() {
  const user = await getServerUser()
  const isAdmin = await hasRole("admin")

  return <div>Hello {user?.name}</div>
}
```

## Route Protection Levels

### 1. Server-Side (Middleware)

- **Fastest**: Runs before the page loads
- **Most Secure**: Cannot be bypassed
- **SEO Friendly**: Proper redirects and status codes

### 2. Layout-Level (AuthWrapper in layouts)

- **Efficient**: Protects entire route groups
- **Good UX**: Shows loading states
- **Flexible**: Can customize per section

### 3. Page-Level (HOCs or AuthWrapper)

- **Granular**: Per-page control
- **Customizable**: Different redirect targets
- **Easy**: Simple to implement

### 4. Component-Level (Guards)

- **Fine-grained**: Protect specific content
- **Conditional**: Based on roles/permissions
- **Reusable**: Can be used anywhere

## Implementation Examples

### Protecting a Dashboard Route

```tsx
// Option 1: Layout-level (recommended for route groups)
// src/app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }) {
  return (
    <AuthWrapper requireAuth={true}>
      <DashboardShell>{children}</DashboardShell>
    </AuthWrapper>
  )
}

// Option 2: Page-level with HOC
// src/app/dashboard/page.tsx
const DashboardPage = () => <div>Dashboard</div>
export default withAuth(DashboardPage)

// Option 3: Page-level with wrapper
// src/app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <AuthWrapper requireAuth={true}>
      <div>Dashboard</div>
    </AuthWrapper>
  )
}
```

### Protecting Admin Content

```tsx
// Admin-only page
export default withAdminGuard(AdminPage)

// Admin section within a page
function MyPage() {
  return (
    <div>
      <PublicContent />
      <AdminGuard>
        <AdminOnlyContent />
      </AdminGuard>
    </div>
  )
}
```

### API Route Protection

```tsx
// src/app/api/admin/route.ts
import { requireAdmin } from "@/lib/auth-utils"

export async function GET() {
  try {
    await requireAdmin() // Throws if not admin
    // ... admin logic
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

### User Invitation Flow

The system supports admin-initiated user invitations with a streamlined verification process:

```tsx
// Admin invites user from settings page
await authClient.admin.createUser({
  email: "newuser@example.com",
  name: "New User",
  password: "temporary-password",
  data: {
    isAdminInvited: true, // Skips verification email
  },
})

// Send password reset email instead
await authClient.forgetPassword({
  email: "newuser@example.com",
  redirectTo: "/reset-password",
})
```

**What happens:**

1. Admin creates user with `isAdminInvited: true` flag
2. System skips sending verification email (due to flag)
3. System sends password reset email instead
4. User clicks password reset link and sets their password
5. System automatically marks user as verified via `onPasswordReset` hook
6. User can immediately log in without additional verification

### Server Component Protection

```tsx
// src/app/profile/page.tsx
import { getServerUser } from "@/lib/auth-utils"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const user = await getServerUser()

  if (!user) {
    redirect("/login")
  }

  return <div>Welcome {user.name}</div>
}
```

## Security Features

### ✅ What's Protected

- **Route access**: Unauthenticated users can't access protected routes
- **Component rendering**: Protected content only shows to authorized users
- **API endpoints**: Server-side auth checks prevent unauthorized API access
- **Session management**: Automatic token refresh and validation

### ✅ Attack Prevention

- **Direct URL access**: Middleware catches unauthorized route access
- **Client-side bypass**: Server-side validation ensures security
- **Token manipulation**: Better Auth handles secure token management
- **CSRF protection**: Built into Better Auth

### ⚠️ Best Practices

1. **Always validate on server**: Client-side checks are for UX only
2. **Use middleware for route protection**: Fastest and most secure
3. **Implement proper error handling**: Don't expose sensitive errors
4. **Keep session checks efficient**: Use context to avoid repeated calls

## Environment Variables

Make sure these are set in your `.env.local`:

```env
# Better Auth configuration
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Database (if using)
DATABASE_URL=your-database-url

# Email (for password reset, etc.)
RESEND_API_KEY=your-resend-key
```

## Testing Authentication

### Manual Testing Checklist

- [ ] Unauthenticated users redirected from protected routes
- [ ] Authenticated users redirected from auth pages
- [ ] Home page (`/`) redirects to `/reports` when authenticated
- [ ] Home page (`/`) redirects to `/login` when not authenticated
- [ ] Login redirects to original intended page
- [ ] Logout works and redirects properly
- [ ] Admin content only visible to admins
- [ ] API routes reject unauthorized requests
- [ ] Admin-invited users are auto-verified after password reset
- [ ] Admin-invited users don't receive verification emails

### Test Cases

```tsx
// Test home page redirect when not authenticated
cy.visit("/")
cy.url().should("include", "/login")

// Test home page redirect when authenticated
cy.login("user@example.com", "password")
cy.visit("/")
cy.url().should("include", "/reports")

// Test protected route
cy.visit("/dashboard")
cy.url().should("include", "/login")

// Test login redirect
cy.login("user@example.com", "password")
cy.url().should("include", "/dashboard")

// Test admin access
cy.loginAsAdmin()
cy.visit("/admin")
cy.contains("Admin Panel").should("be.visible")
```

## Troubleshooting

### Common Issues

1. **Infinite redirect loops**

   - Check middleware route patterns
   - Ensure auth routes are properly excluded

2. **Session not persisting**

   - Verify Better Auth configuration
   - Check cookie settings

3. **Middleware not running**

   - Check `middleware.ts` file location (project root)
   - Verify `config.matcher` patterns

4. **TypeScript errors**
   - Ensure proper imports
   - Check Better Auth type definitions

### Debug Tools

```tsx
// Add to components for debugging
const { user, isAuthenticated, isLoading } = useSessionContext()
console.log({ user, isAuthenticated, isLoading })
```

## Migration Guide

If migrating from another auth system:

1. Install Better Auth and configure
2. Replace existing auth checks with new components
3. Update API routes to use new utilities
4. Test all protected routes
5. Update middleware configuration

## Performance Considerations

- **Middleware**: Runs on every request - keep it fast
- **Session checks**: Cached by Better Auth
- **Component guards**: Only render when needed
- **Server utilities**: Use sparingly in components
