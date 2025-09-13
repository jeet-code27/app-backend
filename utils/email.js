const nodemailer = require("nodemailer");

// Create transporter with your email service credentials
const createTransporter = () => {
  return  nodemailer.createTransport({
  host: "smtp.gmail.com",  // or smtp.sendgrid.net, smtp.mailgun.org, etc.
  port: 465,               // use 465 if you want SSL
  secure: true,           // true if using port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

   
};

// Function for Admin to send a custom email
const sendCustomAdminEmail = async (
  clientName,
  clientEmail,
  subject,
  message,
  adminName = "Admin"
) => {
  try {
    const transporter = createTransporter();

    // Basic styled email template
    const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
    <h2 style="color: #2563eb; margin-bottom: 12px; font-size: 22px; font-weight: bold;">
      A Message from ${adminName}
    </h2>
    
    <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
      Dear <strong>${clientName}</strong>,
    </p>
    
    <p style="font-size: 15px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
      ${message}
    </p>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 32px;">
      Best regards,<br>
      <span style="font-weight: 600; color: #111827;">${adminName}</span><br>
      <span style="color: #2563eb;">SEOcial Media Solution Team</span>
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      © ${new Date().getFullYear()} SEOcial Media Solution. All rights reserved.
    </p>
  </div>
`;

    const mailOptions = {
      from: `"${adminName} (SEOcial Media Solution Team)" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Custom admin email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending custom admin email:", error);
    return { success: false, error: error.message };
  }
};

// Email templates for different statuses
const getEmailTemplate = (status, clientName, requestId) => {
  const templates = {
    reviewing: {
      subject: `Service Request ${requestId} - Under Review`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Request Under Review</h2>
          <p>Dear ${clientName},</p>
          <p>Thank you for submitting your service request. Your request <strong>${requestId}</strong> is now under review by our team.</p>
          <p>We will carefully examine your requirements and get back to you soon with further details.</p>
          <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Status:</strong> Under Review</p>
          </div>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>SEOcial media solution Team</p>
        </div>
      `,
    },
    "in-progress": {
      subject: `Service Request ${requestId} - Work Started`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:white">
          <h2 style="color: #16a34a;">Work Started on Your Request</h2>
          <p>Dear ${clientName},</p>
          <p>Great news! We have started working on your service request <strong>${requestId}</strong>.</p>
          <p>Our team is now actively working on your project. We'll keep you updated on the progress and notify you once it's ready for review.</p>
          <div style="background-color: #f0fdf4; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #16a34a;">
            <p style="margin: 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Status:</strong> In Progress</p>
          </div>
          <p>Thank you for your patience.</p>
          <p>Best regards,<br>SEOcial media solution Team</p>
        </div>
      `,
    },
    revision: {
      subject: `Service Request ${requestId} - Revision Required`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ea580c;">Revision Required</h2>
          <p>Dear ${clientName},</p>
          <p>Your service request <strong>${requestId}</strong> requires some revisions based on your feedback or our quality review.</p>
          <p>Our team is working on the necessary changes to ensure the final deliverable meets your expectations.</p>
          <div style="background-color: #fff7ed; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ea580c;">
            <p style="margin: 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Status:</strong> Under Revision</p>
          </div>
          <p>We'll notify you once the revisions are complete.</p>
          <p>Best regards,<br>SEOcial media solution Team</p>
        </div>
      `,
    },
    completed: {
      subject: `Service Request ${requestId} - Completed`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Your Request is Complete!</h2>
          <p>Dear ${clientName},</p>
          <p>Good news! Your service request <strong>${requestId}</strong> has been completed.</p>
          <p>Our team has finished working on your project and it's ready for your review. You should receive the deliverables shortly.</p>
          <div style="background-color: #ecfdf5; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #059669;">
            <p style="margin: 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Status:</strong> Completed</p>
          </div>
          <p>Please review the deliverables and let us know if you need any adjustments.</p>
          <p>Thank you for choosing our services!</p>
          <p>Best regards,<br>SEOcial media solution Team</p>
        </div>
      `,
    },
    delivered: {
      subject: `Service Request ${requestId} - Delivered`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Deliverables Sent!</h2>
          <p>Dear ${clientName},</p>
          <p>Your service request <strong>${requestId}</strong> has been delivered successfully.</p>
          <p>All deliverables have been sent to you. Please check your email and download the files.</p>
          <div style="background-color: #faf5ff; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #7c3aed;">
            <p style="margin: 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Status:</strong> Delivered</p>
          </div>
          <p>If you have any questions or need support, please don't hesitate to contact us.</p>
          <p>We hope you're satisfied with our work!</p>
          <p>Best regards,<br>SEOcial media solution Team</p>
        </div>
      `,
    },
    cancelled: {
      subject: `Service Request ${requestId} - Cancelled`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Request Cancelled</h2>
          <p>Dear ${clientName},</p>
          <p>Your service request <strong>${requestId}</strong> has been cancelled.</p>
          <p>If this was unexpected or if you have any questions about the cancellation, please contact our support team.</p>
          <div style="background-color: #fef2f2; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #dc2626;">
            <p style="margin: 0;"><strong>Request ID:</strong> ${requestId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Status:</strong> Cancelled</p>
          </div>
          <p>We apologize for any inconvenience caused.</p>
          <p>Best regards,<br>SEOcial media solution Team</p>
        </div>
      `,
    },
  };

  return (
    templates[status] || {
      subject: `Service Request ${requestId} - Status Updated`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Status Update</h2>
        <p>Dear ${clientName},</p>
        <p>Your service request <strong>${requestId}</strong> status has been updated.</p>
        <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0;"><strong>Request ID:</strong> ${requestId}</p>
          <p style="margin: 5px 0 0 0;"><strong>Status:</strong> ${status}</p>
        </div>
        <p>Best regards,<br>SEOcial media solution Team</p>
      </div>
    `,
    }
  );
};

// Main function to send status update email
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

    // Add admin note to email if provided
    let emailContent = template.html;
    if (adminNote) {
      const noteSection = `
        <div style="background-color: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 5px; border: 1px solid #e5e7eb;">
          <h4 style="margin: 0 0 10px 0; color: #374151;">Additional Note:</h4>
          <p style="margin: 0; font-style: italic;">${adminNote}</p>
        </div>
      `;
      // Insert note before the closing message
      emailContent = emailContent.replace(
        "<p>Best regards,<br>Your Service Team</p>",
        `${noteSection}<p>Best regards,<br>SEOcial Media Solution Team</p>`
      );
    }

    const mailOptions = {
      from: `"SEOcial Media Solution Team" <${process.env.EMAIL_USER}>`,
      to: clientEmail,
      subject: template.subject,
      html: emailContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Status update email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending status update email:", error);
    return { success: false, error: error.message };
  }
};

// Additional utility function for sending general emails
const sendEmail = async (to, subject, html, text = "") => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"SEOcial Media Solution Team" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendStatusUpdateEmail,
  sendEmail,
  sendCustomAdminEmail,
};
