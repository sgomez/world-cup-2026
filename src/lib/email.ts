import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "2500", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

export async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const mailOptions = {
    from: process.env.SMTP_FROM || "no-reply@world-cup-2026.dev",
    to: email,
    subject: "Sign in to World Cup 2026",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff; color: #18181b;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #09090b; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: -0.025em;">🏆 World Cup 2026</h1>
        </div>
        <h2 style="color: #18181b; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 12px;">Sign in with Magic Link</h2>
        <p style="color: #71717a; font-size: 15px; line-height: 24px; margin-top: 0; margin-bottom: 24px;">Click the button below to sign in to your account. The link will expire in 5 minutes for security reasons.</p>
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${url}" style="display: inline-block; background-color: #18181b; color: #ffffff; font-size: 15px; font-weight: 600; padding: 12px 32px; text-decoration: none; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">Sign In to App</a>
        </div>
        <p style="color: #71717a; font-size: 14px; line-height: 22px; margin: 0; text-align: center;">
          Or copy and paste this URL into your browser:
        </p>
        <p style="color: #2563eb; font-size: 13px; word-break: break-all; text-align: center; margin-top: 6px; margin-bottom: 24px;">
          <a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
        <p style="color: #a1a1aa; font-size: 12px; line-height: 18px; margin: 0; text-align: center;">
          If you didn't request this email, you can safely ignore it.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
