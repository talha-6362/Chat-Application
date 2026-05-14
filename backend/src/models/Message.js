
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const messageSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: uuidv4,
      unique: true, 
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
      required: false,
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
      index: true 
    },

    isRead: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    
    deliveredAt: { type: Date },
    seenAt: { type: Date },
    readAt: { type: Date }, 

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

messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ status: 1, isRead: 1 }); 
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

messageSchema.pre("save", function (next) {
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.isDeleted = true;
  }
  next();
});

messageSchema.virtual('isSeen').get(function() {
  return this.status === 'seen' || this.isRead === true;
});

messageSchema.methods.markAsSeen = async function() {
  if (this.status !== 'seen' && !this.isRead) {
    this.status = 'seen';
    this.isRead = true;
    this.seenAt = new Date();
    this.readAt = new Date();
    await this.save();
  }
  return this;
};


messageSchema.statics.markManyAsSeen = async function(messageIds) {
  return await this.updateMany(
    { 
      _id: { $in: messageIds },
      status: { $ne: 'seen' },
      isRead: false
    },
    { 
      $set: { 
        status: 'seen', 
        isRead: true, 
        seenAt: new Date(),
        readAt: new Date()
      }
    }
  );
};

const Message = mongoose.model("Message", messageSchema);
export default Message;