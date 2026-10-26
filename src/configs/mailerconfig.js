import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

async function sendEmail(to, subject, html, text) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email settings are missing");
  }

  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
    text,
  });
}

export default sendEmail;