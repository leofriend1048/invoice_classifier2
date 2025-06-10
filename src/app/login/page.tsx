"use client"

import { AuthWrapper } from "@/components/auth/AuthWrapper";
import { Button } from "@/components/Button";
import { Divider } from "@/components/Divider";
import { Input } from "@/components/Input";
import { Label } from "@/components/Label";
import { Logo } from "@/components/ui/Logo";
import { signIn } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

export default function Login() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();
  const searchParams = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return null;
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Get redirect URL from query params
    const redirectTo = searchParams?.get("redirectTo") || "/reports";

    try {
      await signIn.email(
        { email, password },
        {
          onRequest: () => setLoading(true),
          onResponse: (ctx: any) => {
            setLoading(false);
            if (ctx.error) {
              setError(ctx.error.message || "Invalid email or password.");
            }
          },
          onError: (ctx: any) => {
            setLoading(false);
            setError(ctx.error.message || "Invalid email or password.");
          },
          onSuccess: () => {
            setLoading(false);
            setError(null);
            // Redirect to the original page or default to reports
            router.push(redirectTo);
          },
        }
      );
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthWrapper requireAuth={false}>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo className="mx-auto h-12 w-auto" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              Sign in to your account
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <div className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              </div>
            )}

            <div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </div>

            <Divider>or</Divider>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don&apos;t have an account?{" "}
                <a
                  href="/signup"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  Sign up
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </AuthWrapper>
  );
}
