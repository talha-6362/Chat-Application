import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  try {
    if (!ENV.MONGODB_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    const conn = await mongoose.connect(ENV.MONGODB_URI);
  } catch (error) {
    console.error(" MongoDB connection error:", error.message);
    process.exit(1);
  }
};
