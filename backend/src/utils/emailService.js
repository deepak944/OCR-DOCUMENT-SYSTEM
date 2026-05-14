const nodemailer = require('nodemailer');

// Pre-configured transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'appudeepak944@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

const sendWelcomeEmail = async (userEmail, userName) => {
  const mailOptions = {
    from: '"TEXTTRACK AI" <appudeepak944@gmail.com>',
    to: userEmail,
    subject: 'Welcome to TEXTTRACK AI! 🚀',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; font-size: 28px; font-weight: 700; margin-bottom: 5px;">TEXTTRACK <span style="color: #a855f7;">AI</span></h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Your Intelligent Document Assistant</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 30px;">
          <h2 style="margin: 0; font-size: 24px;">Welcome, ${userName}!</h2>
          <p style="margin-top: 10px; font-size: 16px; opacity: 0.9;">We're thrilled to have you on board.</p>
        </div>
        
        <div style="color: #334155; line-height: 1.6;">
          <p>Hi ${userName},</p>
          <p>Thank you for joining <strong>TEXTTRACK AI</strong>! You're now ready to transform your document workflows with state-of-the-art OCR and AI-powered insights.</p>
          
          <div style="margin: 30px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">What can you do next?</h3>
            <ul style="padding-left: 20px; margin-bottom: 0;">
              <li style="margin-bottom: 10px;"><strong>Upload PDFs:</strong> Extract text and tables instantly.</li>
              <li style="margin-bottom: 10px;"><strong>AI Chat:</strong> Ask questions about your documents.</li>
              <li style="margin-bottom: 10px;"><strong>Export:</strong> Save results as Word or Excel files.</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="http://localhost:5173" style="background-color: #6366f1; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Go to Dashboard</a>
          </div>
          
          <p style="font-size: 14px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            If you have any questions, feel free to reply to this email. We're here to help!<br><br>
            Best regards,<br>
            <strong>The TEXTTRACK AI Team</strong>
          </p>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #e2e8f0;">
            <p style="margin-bottom: 15px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Connect with the Developer</p>
            <a href="https://linkedin.com/in/deepak" style="display: inline-block; margin: 0 10px; text-decoration: none; color: #6366f1; font-weight: 600; font-size: 14px;">LinkedIn</a>
            <a href="https://github.com/deepak" style="display: inline-block; margin: 0 10px; text-decoration: none; color: #334155; font-weight: 600; font-size: 14px;">GitHub</a>
            <a href="tel:+919353046405" style="display: inline-block; margin: 0 10px; text-decoration: none; color: #64748b; font-weight: 600; font-size: 14px;">Contact</a>
          </div>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully to:', userEmail);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

const sendPasswordResetEmail = async (userEmail, resetLink) => {
  const mailOptions = {
    from: '"TEXTTRACK AI" <appudeepak944@gmail.com>',
    to: userEmail,
    subject: 'Reset your password for TEXTTRACK AI 🛡️',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; font-size: 28px; font-weight: 700; margin-bottom: 5px;">TEXTTRACK <span style="color: #a855f7;">AI</span></h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Secure Document Intelligence</p>
        </div>
        
        <div style="background-color: #f1f5f9; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
          <div style="background-color: #ffffff; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <span style="font-size: 30px;">🔑</span>
          </div>
          <h2 style="margin: 0; color: #1e293b; font-size: 22px;">Password Reset Request</h2>
          <p style="margin-top: 10px; font-size: 14px; color: #64748b;">We received a request to reset your password. Click the button below to choose a new one.</p>
        </div>
        
        <div style="color: #334155; line-height: 1.6;">
          <p>Hello,</p>
          <p>To keep your account secure, please click the button below to reset your password. This link will expire shortly for your security.</p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetLink}" style="background-color: #6366f1; color: #ffffff; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3);">Reset Password</a>
          </div>
          
          <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 20px;">
            If you didn't request this, you can safely ignore this email. No changes will be made to your account.
          </p>
          
          <p style="font-size: 14px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Stay secure,<br>
            <strong>The TEXTTRACK AI Security Team</strong>
          </p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending reset email:', error);
  }
};

const sendPasswordResetSuccessEmail = async (userEmail) => {
  const mailOptions = {
    from: '"TEXTTRACK AI" <appudeepak944@gmail.com>',
    to: userEmail,
    subject: 'Congratulations! Password Reset Successful ✨',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; font-size: 28px; font-weight: 700; margin-bottom: 5px;">TEXTTRACK <span style="color: #a855f7;">AI</span></h1>
        </div>
        
        <div style="background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); padding: 40px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 30px;">
          <div style="font-size: 50px; margin-bottom: 10px;">🎉</div>
          <h2 style="margin: 0; font-size: 24px;">Congratulations!</h2>
          <p style="margin-top: 10px; font-size: 16px; opacity: 0.9;">Your password has been successfully reset.</p>
        </div>
        
        <div style="color: #334155; line-height: 1.6; text-align: center;">
          <p style="font-size: 16px;">You can now log back into your account using your new password.</p>
          
          <div style="margin: 40px 0;">
            <a href="http://localhost:5173/login" style="background-color: #1e293b; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Log In Now</a>
          </div>
          
          <div style="padding: 20px; background-color: #fef2f2; border-radius: 8px; border: 1px solid #fee2e2; margin-top: 30px;">
            <p style="margin: 0; color: #991b1b; font-size: 13px;">
              <strong>Security Tip:</strong> If you did not perform this password reset, please contact our support team immediately to secure your account.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Best regards,<br>
            <strong>The TEXTTRACK AI Team</strong>
          </p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset success email sent to:', userEmail);
  } catch (error) {
    console.error('Error sending reset success email:', error);
  }
};

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordResetSuccessEmail };
