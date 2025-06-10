/**
 * Email templates for Invoice Classifier
 * Professional, responsive HTML email templates
 */

interface EmailTemplateData {
  user: {
    name?: string;
    email: string;
  };
  url: string;
}

/**
 * Base email template structure
 */
const getBaseTemplate = (title: string, content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; line-height: 1.6;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                            <div style="display: inline-block; background-color: #3b82f6; padding: 12px 24px; border-radius: 8px; margin-bottom: 20px;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.02em;">Invoice Classifier</h1>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    ${content}
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0; background-color: #f8fafc; border-radius: 0 0 12px 12px;">
                            <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">
                                © ${new Date().getFullYear()} Invoice Classifier. All rights reserved.
                            </p>
                            <p style="margin: 0; color: #64748b; font-size: 12px;">
                                This email was sent to {userEmail}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

/**
 * Password Reset Email Template
 */
export const getPasswordResetTemplate = ({ user, url }: EmailTemplateData) => {
  const content = `
    <tr>
        <td style="padding: 40px;">
            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600; text-align: center;">Reset Your Password</h2>
            
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; text-align: center;">
                Hello ${user.name || 'there'},
            </p>
            
            <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; text-align: center;">
                We received a request to reset your password for your Invoice Classifier account. Click the button below to create a new password.
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="${url}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; border: 2px solid #3b82f6;">
                    Reset My Password
                </a>
            </div>
            
            <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px;">
                    <strong>Security Note:</strong> This link will expire in 1 hour for your security.
                </p>
                <p style="margin: 0; color: #475569; font-size: 14px;">
                    If you didn't request this password reset, you can safely ignore this email.
                </p>
            </div>
            
            <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 10px 0 0 0; word-break: break-all; text-align: center;">
                <a href="${url}" style="color: #3b82f6; text-decoration: none; font-size: 14px;">${url}</a>
            </p>
        </td>
    </tr>`;

  return getBaseTemplate('Reset Your Password', content).replace('{userEmail}', user.email);
};

/**
 * Email Verification Template
 */
export const getVerificationTemplate = ({ user, url }: EmailTemplateData) => {
  const content = `
    <tr>
        <td style="padding: 40px;">
            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600; text-align: center;">Welcome to Invoice Classifier!</h2>
            
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; text-align: center;">
                Hello ${user.name || 'there'},
            </p>
            
            <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; text-align: center;">
                Thanks for signing up! We're excited to help you streamline your invoice processing. To get started, please verify your email address by clicking the button below.
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="${url}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; border: 2px solid #10b981;">
                    Verify My Email
                </a>
            </div>
            
            <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin: 30px 0; border-left: 4px solid #3b82f6;">
                <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                    🎉 What's next?
                </p>
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                    Once verified, you'll be able to upload invoices, classify expenses, and start managing your financial documents efficiently.
                </p>
            </div>
            
            <p style="margin: 30px 0 0 0; color: #64748b; font-size: 14px; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 10px 0 0 0; word-break: break-all; text-align: center;">
                <a href="${url}" style="color: #3b82f6; text-decoration: none; font-size: 14px;">${url}</a>
            </p>
        </td>
    </tr>`;

  return getBaseTemplate('Welcome to Invoice Classifier', content).replace('{userEmail}', user.email);
};

/**
 * Email template subjects
 */
export const EMAIL_SUBJECTS = {
  PASSWORD_RESET: 'Reset your Invoice Classifier password',
  EMAIL_VERIFICATION: 'Welcome to Invoice Classifier - Verify your account',
} as const; 