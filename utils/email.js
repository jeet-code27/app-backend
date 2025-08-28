const nodemailer = require("nodemailer");

// ✅ Create Gmail transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // your Gmail address
      pass: process.env.EMAIL_PASS, // your Gmail App Password
    },
  });
};

// ✅ Send custom email from Admin
const sendCustomAdminEmail = async (
  clientName,
  clientEmail,
  subject,
  message,
  adminName = "Admin"
) => {
  try {
    const transporter = createTransporter();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #2563eb;">Message from ${adminName}</h2>
        <p>Dear <strong>${clientName}</strong>,</p>
        <p>${message}</p>
        <p style="margin-top: 24px;">Best regards,<br><strong>${adminName}</strong><br>SEOcial Media Solution Team</p>
      </div>
    `;

    const mailOptions = {
      from: `"${adminName} (SEOcial Media Solution)" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Custom admin email sent:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending custom admin email:", error);
    return { success: false, error: error.message };
  }
};

// ✅ Predefined templates by status
const getEmailTemplate = (status, clientName, requestId) => {
  const templates = {
    reviewing: {
      subject: `Service Request ${requestId} - Under Review`,
      html: `
        <h2 style="color:#2563eb;">Request Under Review</h2>
        <p>Dear ${clientName},</p>
        <p>Your request <strong>${requestId}</strong> is under review.</p>
        <p>We’ll update you shortly.</p>
        <p>Best regards,<br>SEOcial Media Solution Team</p>
      `,
    },
    "in-progress": {
      subject: `Service Request ${requestId} - Work Started`,
      html: `
        <h2 style="color:#16a34a;">Work Started</h2>
        <p>Dear ${clientName},</p>
        <p>We’ve started working on <strong>${requestId}</strong>.</p>
        <p>Best regards,<br>SEOcial Media Solution Team</p>
      `,
    },
    completed: {
      subject: `Service Request ${requestId} - Completed`,
      html: `
        <h2 style="color:#059669;">Request Completed</h2>
        <p>Dear ${clientName},</p>
        <p>Your request <strong>${requestId}</strong> is completed.</p>
        <p>Best regards,<br>SEOcial Media Solution Team</p>
      `,
    },
  };

  return (
    templates[status] || {
      subject: `Service Request ${requestId} - Status Updated`,
      html: `
        <h2>Status Update</h2>
        <p>Dear ${clientName},</p>
        <p>Your request <strong>${requestId}</strong> status: ${status}</p>
        <p>Best regards,<br>SEOcial Media Solution Team</p>
      `,
    }
  );
};

// ✅ Send status update emails
const sendStatusUpdateEmail = async (
  clientEmail,
  clientName,
  requestId,
  status,
  adminNote = ""
) => {
  try {
    const transporter = createTransporter();
    const template = getEmailTemplate(status, clientName, requestId);

    let emailContent = template.html;
    if (adminNote) {
      emailContent += `
        <div style="margin-top:20px; padding:10px; border-left:3px solid #ddd;">
          <p><strong>Note from Admin:</strong> ${adminNote}</p>
        </div>
      `;
    }

    const mailOptions = {
      from: `"SEOcial Media Solution" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: template.subject,
      html: emailContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Status update email sent:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending status update email:", error);
    return { success: false, error: error.message };
  }
};

// ✅ Generic sendEmail
const sendEmail = async (to, subject, html, text = "") => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"SEOcial Media Solution" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ General email sent:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendCustomAdminEmail,
  sendStatusUpdateEmail,
  sendEmail,
};
