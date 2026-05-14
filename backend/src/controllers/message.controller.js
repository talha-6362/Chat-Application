import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";


export const getAllContacts = async (req, res) => {
  try {
    const userId = req.user._id;
    const users = await User.find({ _id: { $ne: userId } }).select("-password -emailVerificationToken");
    res.status(200).json(users);
  } catch (error) {
    console.error(" Error in getAllContacts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: chatUserId } = req.params;
    const messages = await Message.find({
  $or: [
    { senderId: myId, receiverId: chatUserId },
    { senderId: chatUserId, receiverId: myId },
  ],
  deletedFor: { $ne: myId },
})
.sort({ createdAt: 1 })
.lean();
    const formattedMessages = messages.map(msg => ({
      ...msg,
      _id: msg._id.toString(),
      senderId: msg.senderId.toString(),
      receiverId: msg.receiverId.toString(),
    }));

    res.status(200).json(formattedMessages);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const getChatPartners = async (req, res) => {
  try {
    const userId = req.user._id;

    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).sort({ updatedAt: -1 });

    const partnerIds = [
      ...new Set(
        messages.map((m) =>
          m.senderId.toString() === userId.toString()
            ? m.receiverId.toString()
            : m.senderId.toString()
        )
      ),
    ];

    const partners = await User.find({ _id: { $in: partnerIds } }).select(
      "fullName profilePic lastSeen isOnline"
    );

    const partnersWithProfilePic = partners.map((p) => ({
      _id: p._id,
      fullName: p.fullName,
      profilePic: p.profilePic || "/avatar.png", 
      lastSeen: p.lastSeen,
      isOnline: p.isOnline,
    }));

    res.status(200).json(partnersWithProfilePic);
  } catch (error) {
    console.error("Error in getChatPartners:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const sendMessage = async (req, res) => {
  try {
    const { text, image, replyToMessageId } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Message content or image required." });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let uploadedImage = null;
    if (image) {
      const upload = await cloudinary.uploader.upload(image, {
        resource_type: "image",
      });

      uploadedImage = {
        url: upload.secure_url,
        type: "image",
      };
    }

    let replyToId = null;
    if (replyToMessageId) {
      const originalMessage = await Message.findById(replyToMessageId);
      if (originalMessage) {
        replyToId = originalMessage._id;
      }
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text || "",
      attachment: uploadedImage,
      status: "sent",
      replyTo: replyToId,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    if (newMessage.replyTo) {
      await newMessage.populate("replyTo", "text senderId");
    }

    const receiverSocket = getReceiverSocketId(receiverId);
    if (receiverSocket) {
  io.to(receiverSocket).emit("newMessage", newMessage);

  const updatedMsg = await Message.findByIdAndUpdate(
    newMessage._id,
    { status: "delivered", deliveredAt: new Date() },
    { new: true }
  );

  const senderSocket = getReceiverSocketId(senderId.toString());

  if (senderSocket) {
    io.to(senderSocket).emit("messageStatusUpdated", {
      messageId: updatedMsg._id,
      status: "delivered",
    });
  }
}

    const formattedMessage = {
      ...newMessage.toObject(),
      _id: newMessage._id.toString(),
      senderId: newMessage.senderId.toString(),
      receiverId: newMessage.receiverId.toString(),
    };

    res.status(201).json(formattedMessage);

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found." });
    if (!msg.senderId.equals(userId))
      return res.status(403).json({ message: "Unauthorized action." });

    msg.text = text;
    msg.editedAt = new Date();
    await msg.save();

    res.status(200).json(msg);
  } catch (error) {
    console.error("Error in editMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { forEveryone } = req.body;
    const userId = req.user._id;

    const msg = await Message.findById(messageId);
    if (!msg) {
      return res.status(404).json({ message: "Message not found." });
    }

    if (!msg.senderId.equals(userId) && !msg.receiverId.equals(userId)) {
      return res.status(403).json({ message: "Unauthorized delete." });
    }

    let payload = {};
    if (forEveryone && msg.senderId.equals(userId)) {
      msg.isDeleted = true;
      msg.text = "✨ This message was deleted by the sender ✨";
      msg.attachments = null;

      await msg.save();

      payload = {
        messageId: msg._id.toString(),
        forEveryone: true,
        isDeleted: true,
        text: msg.text,
        deletedBy: userId.toString(),
        deletedByName: req.user.fullName
      };

      const senderSocketId = getReceiverSocketId(msg.senderId.toString());
      const receiverSocketId = getReceiverSocketId(msg.receiverId.toString());

      console.log("Emitting delete for everyone:", {
        messageId: msg._id,
        senderSocketId,
        receiverSocketId
      });

      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDeleted", payload);
      }

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageDeleted", payload);
      }
    }
    
    else if (!forEveryone) {
      if (!msg.deletedFor.includes(userId)) {
        msg.deletedFor.push(userId);
        await msg.save();
      }

      payload = {
        messageId: msg._id.toString(),
        forEveryone: false,
        deletedFor: userId.toString(),
      };

      const userSocketId = getReceiverSocketId(userId.toString());
      if (userSocketId) {
        io.to(userSocketId).emit("messageDeleted", payload);
      }
    }

    res.status(200).json(payload);

  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found." });

    const already = msg.reactions.find(
      (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    if (already) {
      return res.status(400).json({ message: "Reaction already added." });
    }

    msg.reactions.push({ userId, emoji });
    await msg.save();

    const receiverSocketId = getReceiverSocketId(msg.receiverId.toString());
    const senderSocketId = getReceiverSocketId(userId.toString());

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("reactionUpdated", msg);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("reactionUpdated", msg);
    }

    res.status(200).json(msg);
  } catch (error) {
    console.error("Error in addReaction:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const removeReaction = async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const { receiverId } = req.body; 
    const userId = req.user._id;

    const msg = await Message.findById(messageId);
    if (!msg) {
      return res.status(404).json({ message: "Message not found." });
    }

    const reactionExists = msg.reactions.find(
      (r) => r.userId.toString() === userId.toString() && r.emoji === emoji
    );

    if (!reactionExists) {
      return res.status(403).json({
        message: "You can only remove your own reaction",
      });
    }

    msg.reactions = msg.reactions.filter(
      (r) => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
    );

    await msg.save();

    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("reactionUpdated", msg);
    }

const senderSocketId = getReceiverSocketId(userId);

if (senderSocketId) {
  io.to(senderSocketId).emit("reactionUpdated", msg);
}
    res.status(200).json(msg);

  } catch (error) {
    console.error("Error in removeReaction:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const result = await Message.updateMany(
      { 
        receiverId: userId,      
        senderId: chatId,        
        isRead: false            
      },
      { 
        $set: { 
          isRead: true, 
          status: "seen",
          seenAt: new Date()
        } 
      }
    );

    const senderSocketId = getReceiverSocketId(chatId);  
    const receiverSocketId = getReceiverSocketId(userId); 
    
    const seenData = { 
      chatId: userId,  
      seenAt: new Date(),
      seenBy: userId.toString()
    };
    
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesSeen", seenData);
    }
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messagesSeen", seenData);
    }

    res.status(200).json({ 
      message: "Messages marked as read",
      updatedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error("Error in markAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
