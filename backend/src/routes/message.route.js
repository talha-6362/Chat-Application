import express from "express";
import {
  getAllContacts,
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
  deleteMessage,
  editMessage,
  addReaction,
  removeReaction,
  markAsRead,
  markAsDelivered,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// 🛡 Apply rate-limit + auth globally
router.use(arcjetProtection, protectRoute);

/* 
====================================
 📩 MESSAGE ROUTES
====================================
*/

// 🧾 Get unique chat contacts
router.get("/contacts", getAllContacts);

// 💬 Get all chat partners with latest message
router.get("/chats", getChatPartners);

// 📥 Get messages with a specific user/chat
router.get("/:id", getMessagesByUserId);

// 📤 Send a message (text/media)
router.post("/send/:id", sendMessage);

// ✏️ Edit a message — sender only
router.put("/edit/:messageId", editMessage);

// 🗑️ Delete a message (for sender or all)
router.delete("/delete/:messageId", deleteMessage);

// 😀 Add emoji reaction
router.post("/reaction/:messageId", addReaction);

// 😐 Remove emoji reaction
router.delete("/reaction/:messageId/:emoji", removeReaction);

// 👁️ Mark messages as read
router.put("/read/:chatId", markAsRead);

// 📬 Mark as delivered (real-time)
router.put("/delivered/:chatId", markAsDelivered);

export default router;
/* ============================================
    📤 SEND MESSAGE (Text/Media
    /File
    ) - CONTROLLER
============================================ */