import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";

const app = express();
const server = http.createServer(app);

// Initialize socket.io server with CORS
const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

// Track online users
const userSocketMap = new Map();

// Helper: Get receiver socket ID
function getReceiverSocketId(userId) {
  return userSocketMap.get(userId);
}

// Authenticate socket connections
io.use(socketAuthMiddleware);

// Main connection handler
io.on("connection", (socket) => {
  const user = socket.user;

  if (!user || !user._id) {
    console.warn("Invalid socket connection attempt");
    socket.disconnect(true);
    return;
  }

  const userId = user._id.toString();
  userSocketMap.set(userId, socket.id);

  console.log(` User connected: ${user.fullName}`);
  io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

  //  Send message
  socket.on("sendMessage", async (data) => {
    try {
      const { receiverId, text, attachments } = data;
      if (!receiverId || (!text && !attachments)) return;

      const newMsg = await Message.create({
        senderId: userId,
        receiverId,
        text,
        attachments: attachments || [],
        status: "sent",
        sentAt: new Date(),
      });

      const receiverSocketId = getReceiverSocketId(receiverId);

      // Deliver instantly if receiver online
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMsg);

        await Message.findByIdAndUpdate(newMsg._id, {
          status: "delivered",
          deliveredAt: new Date(),
        });

        //  Consistent format for message status update
        io.to(socket.id).emit("messageStatusUpdated", {
          messageId: newMsg._id,
          status: "delivered",
        });
      }

      io.to(socket.id).emit("messageSent", newMsg);
    } catch (error) {
      console.error(" Error in sendMessage:", error.message);
    }
  });

  //  Confirm delivery (consistent payload format)
  socket.on("messageDelivered", async ({ messageId }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId,
        { status: "delivered", deliveredAt: new Date() },
        { new: true }
      );

      if (updated) {
        const senderSocket = getReceiverSocketId(updated.senderId.toString());
        if (senderSocket) {
          io.to(senderSocket).emit("messageStatusUpdated", {
            messageId: updated._id,
            status: updated.status,
          });
        }
      }
    } catch (error) {
      console.error(" Delivery update failed:", error.message);
    }
  });

  //  Mark messages as read
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

  //  Edit message
  socket.on("editMessage", async ({ messageId, newText, receiverId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.senderId.toString() !== userId) return;

      msg.text = newText;
      msg.editedAt = new Date();
      await msg.save();

      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit("messageEdited", msg);
      io.to(socket.id).emit("messageEdited", msg);
    } catch (error) {
      console.error(" editMessage failed:", error.message);
    }
  });

  //  Delete message
  socket.on("deleteMessage", async ({ messageId, receiverId, forAll }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg || msg.senderId.toString() !== userId) return;

      if (forAll) {
        msg.isDeleted = true;
        msg.text = "This message was deleted";
        msg.attachments = [];
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

  //  Message reactions
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

  //  Typing indicator
  socket.on("typing", ({ receiverId, isTyping }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId)
      io.to(receiverSocketId).emit("typingStatus", {
        senderId: userId,
        isTyping,
      });
  });

  //  Handle disconnect
  socket.on("disconnect", () => {
    console.log(` User disconnected: ${user.fullName}`);
    userSocketMap.delete(userId);
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  });
});

export { io, app, server, getReceiverSocketId };
