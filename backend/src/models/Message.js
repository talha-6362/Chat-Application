import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const messageSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },

    text: {
      type: String,
      trim: true,
      maxlength: 3000,

    },

    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file", "system", "reply"],
      default: "text",
    },

    attachment: {
      url: { type: String },
      mimeType: { type: String },
      fileName: { type: String },
      size: { type: Number },
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: String,
        _id: false,
      },
    ],

    status: {
      type: String,
      enum: ["sent", "delivered", "seen", "failed"],
      default: "sent",
    },

    isRead: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    seenAt: { type: Date },

    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    editedAt: { type: Date },

    expiresAt: { type: Date },

    metadata: {
      ipAddress: String,
      userAgent: String,
      location: String,
    },
  },
  { timestamps: true }
);

// Indexing
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ uuid: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Hooks
messageSchema.pre("save", function (next) {
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.isDeleted = true;
  }
  next();
});

const Message = mongoose.model("Message", messageSchema);
export default Message;
