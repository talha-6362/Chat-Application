import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ENV } from "../lib/env.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    let token;

    // 1️⃣ Extract JWT from cookie or headers
    const cookieHeader = socket.handshake.headers.cookie;
    const authHeader = socket.handshake.headers.authorization;

    if (cookieHeader) {
      token = cookieHeader
        ?.split("; ")
        .find((row) => row.startsWith("jwt="))
        ?.split("=")[1];
    } else if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2️⃣ No token found
    if (!token) {
      console.warn("🚫 Socket connection rejected: No token provided");
      return next(new Error("Unauthorized: No token provided"));
    }

    // 3️⃣ Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        console.warn("⚠️ Socket token expired");
        return next(new Error("Unauthorized: Token expired"));
      }
      console.error("❌ Invalid token:", err.message);
      return next(new Error("Unauthorized: Invalid token"));
    }

    // 4️⃣ Fetch user from DB
    const user = await User.findById(decoded.userId).select(
      "-password -__v"
    );

    if (!user) {
      console.warn("🚫 Socket connection rejected: User not found");
      return next(new Error("Unauthorized: User not found"));
    }

    if (user.status === "blocked") {
      console.warn(`🚫 Blocked user (${user._id}) tried to connect`);
      return next(new Error("Access denied: User blocked"));
    }

    socket.user = user;
    socket.userId = user._id.toString();
    socket.connectedAt = new Date();



    next(); 
  } catch (error) {
    console.error("❌ Socket authentication failed:", error.message);
    next(new Error("Unauthorized: Authentication failed"));
  }
};
