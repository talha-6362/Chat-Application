import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

export const generateToken = (userId, res) => {
  const { JWT_SECRET } = ENV;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not Configured");
  }

  const token = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d",
  });

  const isProduction = process.env.NODE_ENV === "production";
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, 
    sameSite: isProduction ? "none" : "lax", 
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };

  if (isProduction) {
    cookieOptions.domain = ".vercel.app";
  }

  res.cookie("jwt", token, cookieOptions);
  
  console.log(`✅ Token generated for user ${userId}`);
  console.log(`🔐 Cookie Options:`, cookieOptions);

  return token;
};