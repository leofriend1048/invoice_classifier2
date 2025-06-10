"use client";
export const dynamic = "force-dynamic";

import { Button } from "@/components/Button";
import { Divider } from "@/components/Divider";
import { Input } from "@/components/Input";
import { Label } from "@/components/Label";
import { Logo } from "@/components/ui/Logo";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense } from "react";

function ResetPasswordForm() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [passwordConfirmation, setPasswordConfirmation] = React.useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      
      // Auto-verify the user after successful password reset
      if (result.data?.user?.id) {
        try {
          await fetch('/api/auth/reset-password-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: result.data.user.id })
          });
          console.log('User auto-verified after password reset');
        } catch (verifyError) {
          console.error('Failed to auto-verify user:', verifyError);
          // Don't throw error here as password reset was successful
        }
      }
      
      setSuccess("Your password has been reset. You can now log in.");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div className="flex w-full flex-col items-start sm:max-w-sm">
        <div className="relative flex items-center justify-center rounded-lg bg-white p-3 shadow-lg ring-1 ring-black/5">
          <Logo
            className="size-8 text-blue-500 dark:text-blue-500"
            aria-label="Insights logo"
          />
        </div>
        <div className="mt-6 flex flex-col">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Enter your new password for <span className="font-medium">{email}</span>
          </p>
        </div>
        <div className="mt-10 w-full">
          <Divider className="mb-6">Set New Password</Divider>
          {!token ? (
            <div className="text-sm text-red-600 dark:text-red-400 mb-4">Invalid or missing reset token.</div>
          ) : (
          <form
            onSubmit={handleSubmit}
            className="flex w-full flex-col gap-y-6"
            autoComplete="on"
          >
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="password-form-item" className="font-medium">
                  New Password
                </Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  name="password"
                  id="password-form-item"
                  placeholder="New password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <Label htmlFor="password-confirmation-form-item" className="font-medium">
                  Confirm New Password
                </Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  name="password-confirmation"
                  id="password-confirmation-form-item"
                  placeholder="Confirm new password"
                  required
                  value={passwordConfirmation}
                  onChange={e => setPasswordConfirmation(e.target.value)}
                />
              </div>
            </div>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            )}
            {success && (
              <div className="text-sm text-green-600 dark:text-green-400">{success}</div>
            )}
            <Button
              type="submit"
              isLoading={loading}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Reset Password"}
            </Button>
          </form>
          )}
        </div>
        <Divider />
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Remembered your password?{' '}
          <a
            className="text-blue-500 hover:text-blue-600 dark:text-blue-500 hover:dark:text-blue-400"
            href="/login"
          >
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
} 