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
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/contacts", getAllContacts);
router.get("/chats", getChatPartners);

router.post("/send/:id", sendMessage);
router.put("/edit/:messageId", editMessage);
router.delete("/delete/:messageId", deleteMessage);

router.post("/reaction/:messageId", addReaction);
router.delete("/reaction/:messageId/:emoji", removeReaction);

router.put("/read/:chatId", markAsRead);

router.get("/:id", getMessagesByUserId);

export default router;