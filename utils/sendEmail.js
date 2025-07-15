const nodemailer = require("nodemailer");

const sendEmail = async () => {
  try {
    // Create the transporter using Mailtrap SMTP credentials
    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: "1b76589a3a52fa", // replace with your actual Mailtrap user
        pass: "a2e3c8cf5403ee"  // replace with your actual Mailtrap password
      }
    });

    // Create the message
    const message = {
      from: "Drift n' Dash <no-reply@driftndash.com>",  // sender
      to: "test@example.com",                           // receiver (Mailtrap will catch this)
      subject: "Order Updated!",
      html: "<h1>Hello!</h1><p>This is a test email sent using async/await with Mailtrap.</p>"
    };

    // Send the email
    const info = await transporter.sendMail(message);

    console.log(" Email sent successfully!");
    console.log(" Message ID:", info.messageId);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
};

module.exports = sendEmail;