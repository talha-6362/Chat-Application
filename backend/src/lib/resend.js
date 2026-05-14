import { Resend } from "resend";
import { ENV } from "./env.js";

if (!ENV.RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY in environment variables.");
}

export const resendClient = new Resend(ENV.RESEND_API_KEY);

export const sender = {
  email: "onboarding@resend.dev",
  name: ENV.EMAIL_FROM_NAME || "Chat Application",
};
