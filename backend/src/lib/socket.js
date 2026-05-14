import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import Message from "../models/Message.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

const userSocketMap = new Map();

function getReceiverSocketId(userId) {
  return userSocketMap.get(userId);
}

io.use(socketAuthMiddleware);

io.on("connection", (socket) => {
  const user = socket.user;

  if (!user || !user._id) {
    console.warn("Invalid socket connection attempt");
    socket.disconnect(true);
    return;
  }

  const userId = user._id.toString();
  userSocketMap.set(userId, socket.id);

  io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  // Send message
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

  const updatedMsg = await Message.findByIdAndUpdate(
    newMsg._id,
    {
      status: "delivered",
      deliveredAt: new Date(),
    },
    { new: true }
  );

  // 🔥 SEND TO SENDER (CRITICAL FIX)
  const senderSocketId = socket.id;


  io.to(senderSocketId).emit("messageStatusUpdated", {
    messageId: updatedMsg._id,
    status: "delivered",
  });
} else {
}

      io.to(socket.id).emit("messageSent", newMsg);
    } catch (error) {
      console.error("❌ Error in sendMessage:", error.message);
    }
  });

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
      console.error("❌ Delivery update failed:", error.message);
    }
  });

  //  Mark messages as read 
  socket.on("markAsRead", async ({ chatId, messageIds }) => {
    try {
      // Validate input
      if (!chatId || !messageIds || messageIds.length === 0) {
        console.warn("Invalid markAsRead payload:", { chatId, messageIds });
        return;
      }


      // Update messages in database
      const updatedMessages = await Message.updateMany(
        { _id: { $in: messageIds } },
        { 
          status: "seen", 
          isRead: true, 
          seenAt: new Date(),
          readAt: new Date()
        }
      );

      if (updatedMessages.modifiedCount > 0) {
        // 🔥 FIX 2: Send proper payload with messageIds to the SENDER
        const senderSocket = getReceiverSocketId(chatId);
        
        if (senderSocket) {
          io.to(senderSocket).emit("messagesSeen", {
            chatId: userId, // Current user's ID (receiver)
            messageIds: messageIds // Include which messages were seen
          });
        }

        // Also emit to current user for consistency
        io.to(socket.id).emit("messagesSeen", {
          chatId: userId,
          messageIds: messageIds
        });
      }
    } catch (error) {
      console.error("❌ markAsRead failed:", error.message);
    }
  });

  // Edit message
 socket.on("editMessage", async ({ messageId, newText }) => {
  try {
    const msg = await Message.findById(messageId);

    if (!msg) return;

    // security check
    if (msg.senderId.toString() !== userId) return;

    msg.text = newText;
    msg.editedAt = new Date();

    await msg.save();

    const payload = {
      _id: msg._id,
      text: msg.text,
      editedAt: msg.editedAt
    };

    // auto detect receiver
    const receiverSocketId = getReceiverSocketId(
      msg.receiverId.toString()
    );

    // receiver realtime update
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", payload);
    }

    // sender realtime update
    socket.emit("messageEdited", payload);

  } catch (error) {
    console.error("❌ editMessage failed:", error.message);
  }
});
  // Message reactions
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
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReactionUpdated", msg);
    }

    io.to(socket.id).emit("messageReactionUpdated", msg);

  } catch (error) {
    console.error("❌ Reaction update failed:", error.message);
  }
});

  // Typing indicator
  socket.on("typing", ({ receiverId, isTyping }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId)
      io.to(receiverSocketId).emit("typingStatus", {
        senderId: userId,
        isTyping,
      });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    userSocketMap.delete(userId);
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  });
});

export { io, app, server, getReceiverSocketId };