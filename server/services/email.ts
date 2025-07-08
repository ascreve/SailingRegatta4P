import nodemailer from 'nodemailer';
import { log } from '../vite';

// Create a transporter for sending emails
// For production, you would configure this with real SMTP credentials
let transporter: nodemailer.Transporter;

// Initialize the email transporter
export function initializeEmailService() {
  // Check if we have SMTP credentials in environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    // Configure with real SMTP server
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    log('Email service initialized with real SMTP server', 'email');
  } else {
    // Use Ethereal for development/testing (https://ethereal.email/)
    // This creates a test account and logs the credentials and preview URL
    nodemailer.createTestAccount().then(testAccount => {
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      log(`Email service initialized with test account: ${testAccount.user}`, 'email');
    }).catch(err => {
      log(`Failed to create test email account: ${err.message}`, 'email');
      // Fallback to a mock transport
      transporter = createMockTransporter();
    });
  }
}

// Create a mock transporter for when email is not available
function createMockTransporter(): nodemailer.Transporter {
  return {
    sendMail: async (options: nodemailer.SendMailOptions) => {
      log(`[MOCK EMAIL] Would send email: 
        To: ${options.to}
        Subject: ${options.subject}
        Text: ${options.text}`, 'email');
      return {
        messageId: `mock_${Date.now()}`,
        accepted: [options.to],
        rejected: [],
        pending: [],
        response: 'Mock email sent successfully',
      };
    },
  } as any;
}

// Send a password reset email
export async function sendPasswordResetEmail(
  email: string, 
  resetToken: string,
  username: string,
) {
  try {
    // Ensure transporter is initialized
    if (!transporter) {
      log('Email transporter not initialized, creating mock transporter...', 'email');
      transporter = createMockTransporter();
    }

    // Generate the reset URL - use the client URL
    const baseUrl = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    // Send the email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"GOAT Sailing Race" <noreply@goatsailingrace.com>',
      to: email,
      subject: 'Reset Your GOAT Sailing Race Password',
      text: `Hello ${username},

You recently requested to reset your password for your GOAT Sailing Race account. Click the link below to reset it:

${resetUrl}

If you did not request a password reset, please ignore this email or contact support if you have concerns.

This link will expire in 24 hours.

Thanks,
The GOAT Sailing Race Team`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px 0;">
    <img src="https://goatsailingrace.com/images/goat-sailing-logo.png" alt="GOAT Sailing Race" style="max-width: 150px;">
    <h1 style="color: #333;">Password Reset</h1>
  </div>
  
  <div style="padding: 20px; background-color: #f9f9f9; border-radius: 5px;">
    <p>Hello ${username},</p>
    
    <p>You recently requested to reset your password for your GOAT Sailing Race account. Click the button below to reset it:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background-color: #0066cc; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Your Password</a>
    </div>
    
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}" style="color: #0066cc; word-break: break-all;">${resetUrl}</a></p>
    
    <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
    
    <p><strong>This link will expire in 24 hours.</strong></p>
  </div>
  
  <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
    <p>© ${new Date().getFullYear()} GOAT Sailing Race. All rights reserved.</p>
  </div>
</div>`,
    });

    log(`Password reset email sent to ${email}: ${JSON.stringify(info)}`, 'email');
    
    // For testing emails: If using Ethereal, return the preview URL
    if (info.messageId && info.messageId.includes('ethereal')) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      log(`Email preview URL: ${previewUrl}`, 'email');
      return { success: true, previewUrl };
    }
    
    return { success: true };
  } catch (error: any) {
    log(`Error sending password reset email: ${error.message}`, 'email');
    return { success: false, error: error.message };
  }
}