import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "Karakas <noreply@karakas.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${APP_URL}/reset-password/${token}`;

  // In development without Resend, log to console
  if (!resend) {
    console.log("=".repeat(60));
    console.log("PASSWORD RESET EMAIL (dev mode - no RESEND_API_KEY)");
    console.log("=".repeat(60));
    console.log(`To: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("=".repeat(60));
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your Karakas password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #18181b; color: #fafafa; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto;">
              <h1 style="color: #f59e0b; margin-bottom: 24px;">Reset Your Password</h1>
              <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 24px;">
                We received a request to reset your password for your Karakas account.
                Click the button below to choose a new password.
              </p>
              <a href="${resetUrl}" style="display: inline-block; background-color: #f59e0b; color: #18181b; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 24px;">
                Reset Password
              </a>
              <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
                This link will expire in 1 hour. If you didn't request a password reset,
                you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #3f3f46; margin: 32px 0;">
              <p style="color: #52525b; font-size: 12px;">
                Karakas - MTG Game Tracker
              </p>
            </div>
          </body>
        </html>
      `,
      text: `Reset your Karakas password\n\nWe received a request to reset your password. Visit this link to choose a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.`,
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
