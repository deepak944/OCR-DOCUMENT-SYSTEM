const nodemailer = require('nodemailer');

// Pre-configured transporter using your Gmail App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'appudeepak944@gmail.com',
    pass: 'pica qeyt xilt mfgh'
  }
});

const sendWelcomeEmail = async (userEmail, userName) => {
  const mailOptions = {
    from: '"TextTrack AI" <appudeepak944@gmail.com>',
    to: userEmail,
    subject: 'Welcome to TextTrack AI! 🚀',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; font-size: 28px; font-weight: 700; margin-bottom: 5px;">TextTrack <span style="color: #a855f7;">AI</span></h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Your Intelligent Document Assistant</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 30px;">
          <h2 style="margin: 0; font-size: 24px;">Welcome, ${userName}!</h2>
          <p style="margin-top: 10px; font-size: 16px; opacity: 0.9;">We're thrilled to have you on board.</p>
        </div>
        
        <div style="color: #334155; line-height: 1.6;">
          <p>Hi ${userName},</p>
          <p>Thank you for joining <strong>TextTrack AI</strong>! You're now ready to transform your document workflows with state-of-the-art OCR and AI-powered insights.</p>
          
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
            <strong>The TextTrack AI Team</strong>
          </p>
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

module.exports = { sendWelcomeEmail };
