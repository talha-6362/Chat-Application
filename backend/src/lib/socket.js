import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";

const app = express();
const server = http.createServer(app);

// ✅ Initialize Socket.io with full CORS support
const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// ✅ Store online users (userId: socketId)
const userSocketMap = new Map();

// 🔹 Helper: get receiver’s socketId
function getReceiverSocketId(userId) {
  return userSocketMap.get(userId);
}

// 🧩 Apply authentication middleware (JWT or session)
io.use(socketAuthMiddleware);

// 🧠 Main connection handler
io.on("connection", (socket) => {
  const user = socket.user;
  if (!user || !user._id) {
    console.warn(" Invalid socket user connection attempt");
    return;
  }

  const userId = user._id.toString();
  userSocketMap.set(userId, socket.id);

  console.log(` User connected: ${user.fullName}`);
  io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

  /* ======================================================
   📬 ADVANCED REAL-TIME CHAT EVENTS (WhatsApp-Level)
  ====================================================== */

  // 1️⃣ Send new message
  socket.on("sendMessage", async (data) => {
    try {
      const { receiverId, text, attachments } = data;
      if (!receiverId || (!text && !attachments)) return;

      // Save message to DB
      const newMsg = await Message.create({
        senderId: userId,
        receiverId,
        text,
        attachments: attachments || [],
        status: "sent",
        sentAt: new Date(),
      });

      const receiverSocketId = getReceiverSocketId(receiverId);

      // Notify receiver if online
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMsg);
        await Message.findByIdAndUpdate(newMsg._id, {
          status: "delivered",
          deliveredAt: new Date(),
        });
      }

      // Confirm to sender
      io.to(socket.id).emit("messageSent", newMsg);
    } catch (error) {
      console.error(" Error in sendMessage:", error.message);
    }
  });

  // 2️⃣ Acknowledge delivery (receiver confirms)
  socket.on("messageDelivered", async ({ messageId }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId,
        { status: "delivered", deliveredAt: new Date() },
        { new: true }
      );
      if (updated)
        io.to(getReceiverSocketId(updated.senderId.toString())).emit(
          "messageStatusUpdated",
          updated
        );
    } catch (error) {
      console.error(" Delivery update failed:", error.message);
    }
  });

  // 3️⃣ Mark as read (receiver opens chat)
  socket.on("markAsRead", async ({ chatId, messageIds }) => {
    try {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { status: "seen", isRead: true, seenAt: new Date() }
      );
      io.emit("messagesRead", { chatId, readerId: userId });
    } catch (error) {
      console.error(" markAsRead failed:", error.message);
    }
  });

  // 4️⃣ Edit message (sender only)
  socket.on("editMessage", async ({ messageId, newText, receiverId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.senderId.toString() !== userId) return;

      msg.text = newText;
      msg.editedAt = new Date();
      await msg.save();

      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId)
        io.to(receiverSocketId).emit("messageEdited", msg);

      io.to(socket.id).emit("messageEdited", msg);
    } catch (error) {
      console.error(" editMessage failed:", error.message);
    }
  });

  // 5️⃣ Delete message (for self or everyone)
  socket.on("deleteMessage", async ({ messageId, receiverId, forAll }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.senderId.toString() !== userId) return;

      if (forAll) {
        msg.isDeleted = true;
        msg.deletedFor = [];
      } else {
        msg.deletedFor.push(userId);
      }

      await msg.save();
      const receiverSocketId = getReceiverSocketId(receiverId);

      if (receiverSocketId)
        io.to(receiverSocketId).emit("messageDeleted", { messageId, forAll });

      io.to(socket.id).emit("messageDeleted", { messageId, forAll });
    } catch (error) {
      console.error(" deleteMessage failed:", error.message);
    }
  });

  // 6️⃣ Add / remove emoji reaction
  socket.on("messageReaction", async ({ messageId, emoji, receiverId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      const existing = msg.reactions.find(
        (r) => r.userId.toString() === userId && r.emoji === emoji
      );

      if (existing) {
        msg.reactions = msg.reactions.filter(
          (r) => !(r.userId.toString() === userId && r.emoji === emoji)
        );
      } else {
        msg.reactions.push({ userId, emoji });
      }

      await msg.save();

      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId)
        io.to(receiverSocketId).emit("messageReactionUpdated", msg);

      io.to(socket.id).emit("messageReactionUpdated", msg);
    } catch (error) {
      console.error(" Reaction update failed:", error.message);
    }
  });

  // 7️⃣ Typing indicator
  socket.on("typing", ({ receiverId, isTyping }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId)
      io.to(receiverSocketId).emit("typingStatus", { senderId: userId, isTyping });
  });

  // 8️⃣ Disconnect user
  socket.on("disconnect", () => {
    console.log(` User disconnected: ${user.fullName}`);
    userSocketMap.delete(userId);
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  });
});

export { io, app, server };
