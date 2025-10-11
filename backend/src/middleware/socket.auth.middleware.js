import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ENV } from "../lib/env.js";

/**
 * ✅ Advanced Socket Authentication Middleware
 * - Supports cookie and Authorization header
 * - Validates JWT
 * - Attaches verified user to socket
 * - Prevents connection without valid credentials
 */
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

    // 5️⃣ Optionally check if user is blocked/deactivated
    if (user.status === "blocked") {
      console.warn(`🚫 Blocked user (${user._id}) tried to connect`);
      return next(new Error("Access denied: User blocked"));
    }

    // 6️⃣ Attach user data to socket
    socket.user = user;
    socket.userId = user._id.toString();
    socket.connectedAt = new Date();

    console.log(
      `✅ Socket Authenticated: ${user.fullName} (${user._id}) at ${socket.connectedAt.toISOString()}`
    );

    next(); // ✅ Allow socket connection
  } catch (error) {
    console.error("❌ Socket authentication failed:", error.message);
    next(new Error("Unauthorized: Authentication failed"));
  }
};
