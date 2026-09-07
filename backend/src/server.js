import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";

const PORT = ENV.PORT || 3000;

// DB Connection
connectDB();

app.use(cors({
  origin: ENV.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Root Health-Check Route (for Vercel verification)
app.get("/", (req, res) => {
  res.send("Backend API is running successfully!");
});

// Local Machine Support (Socket.io + Express listen)
if (process.env.NODE_ENV !== "production") {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Vercel Serverless Export
export default app;