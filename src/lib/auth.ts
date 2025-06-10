import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";
import { Resend } from "resend";
import { EMAIL_SUBJECTS, getPasswordResetTemplate, getVerificationTemplate } from "./email-templates";
import { supabaseServer } from "./supabase-server";

// Ensure required environment variables are set
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required but not set in environment variables.");
}
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is required but not set in environment variables.");
}

const databaseUrl = process.env.DATABASE_URL;
const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: new Pool({
    connectionString: databaseUrl,
  }),
  trustedOrigins: [
    "http://localhost:3000",
    process.env.NEXT_PUBLIC_BASE_URL || "https://invoice-classifier-bay.vercel.app"
  ],
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Skip verification email for admin-created users (they'll get password reset instead)
      if ((user as any).data?.isAdminInvited) {
        console.log('[Better Auth] Skipping verification email for admin-invited user:', user.email);
        return;
      }
      
      console.log('[Better Auth] Sending verification email to:', user.email, 'with url:', url);
      try {
        await resend.emails.send({
          from: 'Invoice Classifier <hello@updates.reelfuse.co>',
          to: user.email,
          subject: EMAIL_SUBJECTS.EMAIL_VERIFICATION,
          html: getVerificationTemplate({ user, url })
        });
        console.log('[Better Auth] Verification email sent successfully to:', user.email);
      } catch (err) {
        console.error('[Better Auth] Failed to send verification email to:', user.email, err);
        throw err;
      }
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token } /*, request*/) => {
      const emailRequest = {
        from: 'Invoice Classifier <hello@updates.reelfuse.co>',
        to: user.email,
        subject: EMAIL_SUBJECTS.PASSWORD_RESET,
        html: getPasswordResetTemplate({ user, url })
      };
      console.log('[Better Auth] Attempting to send reset password email:', {
        email: user.email,
        url,
        token,
        emailRequest
      });
      try {
        const response = await resend.emails.send(emailRequest);
        console.log('[Better Auth] Resend API response:', response);
        if (response.error) {
          console.error('[Better Auth] Resend API error:', response.error);
        }
        console.log('[Better Auth] Reset password email sent successfully to:', user.email);
      } catch (err) {
        console.error('[Better Auth] Failed to send reset password email to:', user.email, err);
        throw err;
      }
    },
  },
  plugins: [admin()],
});

export async function sendVerificationEmail({ user, url }: { user: any, url: string }) {
  console.log('[Better Auth] Sending verification email to:', user.email, 'with url:', url);
  try {
    await resend.emails.send({
      from: 'Invoice Classifier <hello@updates.reelfuse.co>',
      to: user.email,
      subject: EMAIL_SUBJECTS.EMAIL_VERIFICATION,
      html: getVerificationTemplate({ user, url })
    });
    console.log('[Better Auth] Verification email sent successfully to:', user.email);
  } catch (err) {
    console.error('[Better Auth] Failed to send verification email to:', user.email, err);
    throw err;
  }
}

// Helper function to auto-verify user after password reset
export async function autoVerifyUser(userId: string) {
  console.log('[Better Auth] Auto-verifying user after password reset:', userId);
  try {
    const { error } = await supabaseServer.from('user').update({ emailVerified: true }).eq('id', userId);
    if (error) {
      console.error('[Better Auth] Failed to set emailVerified=true after password reset for user:', userId, error);
      return false;
    } else {
      console.log('[Better Auth] emailVerified set to true after password reset for user:', userId);
      return true;
    }
  } catch (err) {
    console.error('[Better Auth] Exception in autoVerifyUser:', err);
    return false;
  }
}

// Helper function to auto-verify user by email after password reset
export async function autoVerifyUserByEmail(email: string) {
  console.log('[Better Auth] Auto-verifying user by email after password reset:', email);
  try {
    const { error } = await supabaseServer.from('user').update({ emailVerified: true }).eq('email', email);
    if (error) {
      console.error('[Better Auth] Failed to set emailVerified=true after password reset for user:', email, error);
      return false;
    } else {
      console.log('[Better Auth] emailVerified set to true after password reset for user:', email);
      return true;
    }
  } catch (err) {
    console.error('[Better Auth] Exception in autoVerifyUserByEmail:', err);
    return false;
  }
}