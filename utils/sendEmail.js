const nodemailer = require("nodemailer");

const sendEmail = async ({ email, subject, message }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: '"BunBun Threads" <noreply@bunbunthreads.com>',
    to: email,
    subject: subject,
    html: message
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;