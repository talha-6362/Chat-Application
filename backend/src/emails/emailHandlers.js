import { resendClient, sender } from "../lib/resend.js";
import { createWelcomeEmailTemplate } from "./emailTemplates.js";

export const sendWelcomeEmail = async (email, name, clientURL) => {
  try {
    const { data, error } = await resendClient.emails.send({
      from: `${sender.name} <${sender.email}>`,
      to: email,
      subject: "Welcome to Chat_Application!",
      html: createWelcomeEmailTemplate(name, clientURL),
    });

    if (error) {
      console.error("Resend API error:", error);
      return; 
    }

    console.log("Welcome email sent successfully:", data?.id);
  } catch (err) {
    console.error("Email service failed (non-blocking):", err.message);
  }
};