import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

/* ============================================
   GET ALL CONTACTS (Except Logged-in User)
============================================ */
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

/* ============================================
    FETCH CHAT HISTORY (Between Two Users)
============================================ */
export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: chatUserId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: chatUserId },
        { senderId: chatUserId, receiverId: myId },
      ],
      isDeleted: false,
    })
      .populate("senderId", "fullName avatar")
      .populate("receiverId", "fullName avatar")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error(" Error in getMessagesByUserId:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============================================
    GET CHAT PARTNERS (Recent Chats)
============================================ */
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
      "fullName avatar lastSeen isOnline"
    );

    res.status(200).json(partners);
  } catch (error) {
    console.error(" Error in getChatPartners:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============================================
    SEND MESSAGE (Text, Media, Files)
============================================ */
export const sendMessage = async (req, res) => {
  try {
    const { text, attachment } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    // validation
    if (!text && !attachment) {
      return res.status(400).json({ message: "Message content or file required." });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send message to yourself." });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: "Receiver not found." });

    // handle media upload
    let uploadedFile = null;
    if (attachment?.url) {
      const upload = await cloudinary.uploader.upload(attachment.url, {
        resource_type:
          attachment.type === "video"
            ? "video"
            : attachment.type === "audio"
            ? "auto"
            : "image",
      });
      uploadedFile = {
        url: upload.secure_url,
        type: attachment.type || "image",
        fileName: attachment.fileName || "",
        size: upload.bytes || 0,
      };
    }

    // save message
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      attachment: uploadedFile,
      status: "sent",
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    // emit new message to receiver in real-time
    const receiverSocket = getReceiverSocketId(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit("newMessage", newMessage);
      newMessage.status = "delivered";
      await newMessage.save();
    }

    // notify sender for delivery confirmation
    io.to(getReceiverSocketId(senderId)).emit("messageStatus", {
      messageId: newMessage._id,
      status: newMessage.status,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error(" Error in sendMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============================================
    EDIT MESSAGE (Sender Only)
============================================ */
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

    // emit real-time update
    io.emit("messageEdited", msg);

    res.status(200).json(msg);
  } catch (error) {
    console.error("Error in editMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============================================
    DELETE MESSAGE (For Self or Both)
============================================ */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { forEveryone } = req.body;
    const userId = req.user._id;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found." });

    if (!msg.senderId.equals(userId) && !msg.receiverId.equals(userId))
      return res.status(403).json({ message: "Unauthorized delete." });

    if (forEveryone && msg.senderId.equals(userId)) {
      msg.isDeleted = true;
      msg.text = "This message was deleted";
      msg.attachment = null;
    } else {
      if (!msg.deletedFor.includes(userId)) msg.deletedFor.push(userId);
    }

    await msg.save();

    io.emit("messageDeleted", { messageId, forEveryone });

    res.status(200).json({ message: "Message deleted successfully." });
  } catch (error) {
    console.error(" Error in deleteMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============================================
    ADD REACTION (Emoji)
============================================ */
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
    if (already)
      return res.status(400).json({ message: "Reaction already added." });

    msg.reactions.push({ userId, emoji });
    await msg.save();

    io.emit("reactionAdded", { messageId, userId, emoji });

    res.status(200).json(msg);
  } catch (error) {
    console.error("Error in addReaction:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============================================
    REMOVE REACTION
============================================ */
export const removeReaction = async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user._id;

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ message: "Message not found." });

    msg.reactions = msg.reactions.filter(
      (r) => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
    );
    await msg.save();

    io.emit("reactionRemoved", { messageId, userId, emoji });

    res.status(200).json(msg);
  } catch (error) {
    console.error(" Error in removeReaction:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/* ============================================
    MARK AS READ (Seen Blue Tick)
============================================ */
export const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      { receiverId: userId, senderId: chatId, isRead: false },
      { $set: { isRead: true, status: "seen" } }
    );

    io.to(getReceiverSocketId(chatId)).emit("messagesSeen", { chatId });

    res.status(200).json({ message: "Messages marked as read." });
  } catch (error) {
    console.error(" Error in markAsRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
