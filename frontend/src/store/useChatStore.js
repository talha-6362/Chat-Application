import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const safeGetLocalStorage = (key, defaultValue = false) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.warn(`LocalStorage access blocked for key: ${key}`, e);
    return defaultValue;
  }
};

let notificationAudio = null;

const playNotificationSound = () => {
  if (!notificationAudio) {
    notificationAudio = new Audio("/sounds/notification.mp3");
  }
  notificationAudio.currentTime = 0;
  notificationAudio.play().catch(() => {
  });
};

const pendingRequests = new Map();

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messagesByUserId: {},
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: safeGetLocalStorage("isSoundEnabled", true),

  toggleSound: () => {
    const newSound = !get().isSoundEnabled;
    try {
      localStorage.setItem("isSoundEnabled", JSON.stringify(newSound));
    } catch (e) {
      console.warn("LocalStorage write blocked", e);
    }
    set({ isSoundEnabled: newSound });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });
  },

  // Get All Contacts
  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
      console.error("getAllContacts error:", error);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Get My Chat Partners
  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
      console.error("getMyChatPartners error:", error);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Get Messages By User ID
 getMessagesByUserId: async (userId) => {
  if (!userId) return;
  
  if (pendingRequests.has(userId)) {
    return pendingRequests.get(userId);
  }
  
  const request = (async () => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      
      const mappedMessages = res.data.map(m => ({
        ...m,
        _id: String(m._id),
        senderId: String(m.senderId),  
        receiverId: String(m.receiverId),
        text: m.text || "",
        image: m.attachment?.url || null,
        createdAt: m.createdAt,
        isOptimistic: false,
        reactions: m.reactions || [],
        status: m.status || 'sent',
        editedAt: m.editedAt,
        isDeleted: m.isDeleted || false,
        isRead: m.isRead || false,
        replyTo: m.replyTo,
      }));

      set(state => ({
        messagesByUserId: {
          ...state.messagesByUserId,
          [String(userId)]: mappedMessages
        }
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
      console.error("getMessagesByUserId error:", error);
    } finally {
      set({ isMessagesLoading: false });
      pendingRequests.delete(userId);
    }
  })();
  
  pendingRequests.set(userId, request);
  return request;
},

  // Send Message
  sendMessage: async (messageData) => {
    const { selectedUser } = get();
    const { authUser } = useAuthStore.getState();

    if (!selectedUser) {
      toast.error("No user selected");
      return;
    }

    if (!authUser) {
      toast.error("You are not logged in");
      return;
    }

    const userId = String(selectedUser._id);
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const currentUserId = String(authUser._id);

    const optimisticMessage = {
      _id: tempId,
      senderId: currentUserId,
      receiverId: userId,
      text: messageData.text || "",
      image: messageData.image || null,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      status: 'sent',
      isRead: false,
    };

    const currentMessages = get().messagesByUserId[userId] || [];

    set({
      messagesByUserId: {
        ...get().messagesByUserId,
        [userId]: [...currentMessages, optimisticMessage],
      }
    });

    try {
      const res = await axiosInstance.post(`/messages/send/${userId}`, messageData);

      const newMsg = {
        ...res.data,
        _id: String(res.data._id),
senderId: String(res.data.senderId?._id || res.data.senderId),
        receiverId: String(res.data.receiverId),
        text: res.data.text || "",
        image: res.data.attachment?.url || null,
        createdAt: res.data.createdAt,
        isOptimistic: false,
        reactions: res.data.reactions || [],
        status: res.data.status || 'sent',
        isRead: res.data.isRead || false,
      };

      const updatedMessages = (get().messagesByUserId[userId] || []).map(msg =>
  msg._id === tempId ? newMsg : msg
);

      set({
        messagesByUserId: {
          ...get().messagesByUserId,
          [userId]: updatedMessages,
        }
      });


    } catch (error) {
      console.error("sendMessage error:", error);
      toast.error(error.response?.data?.message || "Failed to send message");

      const messagesWithoutOptimistic = (get().messagesByUserId[userId] || []).filter(
        msg => !msg.isOptimistic || msg._id !== tempId
      );

      set({
        messagesByUserId: {
          ...get().messagesByUserId,
          [userId]: messagesWithoutOptimistic,
        }
      });
    }
  },

  subscribeToMessageStatus: () => {
  const { socket } = useAuthStore.getState();
  if (!socket) return;

  socket.off("messageStatusUpdated");

  socket.on("messageStatusUpdated", ({ messageId, status }) => {
    const allMessages = get().messagesByUserId;

    const updatedMessagesByUser = {};

    for (const userId in allMessages) {
      updatedMessagesByUser[userId] = allMessages[userId].map(msg =>
        String(msg._id) === String(messageId)
          ? { ...msg, status }
          : msg
      );
    }

    set({ messagesByUserId: updatedMessagesByUser });
  });
},
 subscribeToMessages: () => {
  const { isSoundEnabled } = get();
  const { socket, authUser } = useAuthStore.getState();

  if (!socket) {
    console.warn("No socket connection");
    return;
  }

  socket.off("newMessage");
  socket.on("newMessage", (newMessage) => {
    const selectedUserId = get().selectedUser?._id
      ? String(get().selectedUser._id)
      : null;

    if (!selectedUserId) return;

    const senderId = String(newMessage.senderId?._id || newMessage.senderId);
    const receiverId = String(newMessage.receiverId?._id || newMessage.receiverId);
    const currentUserId = String(authUser?._id);

    const isRelevant =
      senderId === selectedUserId || receiverId === selectedUserId;

    if (!isRelevant) return;

    const normalizedMessage = {
      ...newMessage,
      _id: String(newMessage._id),
      senderId,
      receiverId,
      text: newMessage.text || "",
      image: newMessage.attachment?.url || null,
      createdAt: newMessage.createdAt,
      isOptimistic: false,
      reactions: newMessage.reactions || [],
      status: newMessage.status || "sent",
      isRead: newMessage.isRead || false,
    };

    const currentMessages = get().messagesByUserId[selectedUserId] || [];

    const isDuplicate = currentMessages.some(
      (msg) => String(msg._id) === normalizedMessage._id
    );

    if (!isDuplicate) {
      const messagesWithoutOptimistic = currentMessages.filter(
        (msg) =>
          !msg.isOptimistic ||
          String(msg._id) !== normalizedMessage._id
      );

      set({
        messagesByUserId: {
          ...get().messagesByUserId,
          [selectedUserId]: [
            ...messagesWithoutOptimistic,
            normalizedMessage,
          ],
        },
      });

      if (isSoundEnabled && senderId !== currentUserId) {
        playNotificationSound();
      }
    }
  });

  socket.off("reactionUpdated");
  socket.on("reactionUpdated", (updatedMessage) => {
    const selectedUserId = get().selectedUser?._id
      ? String(get().selectedUser._id)
      : null;

    if (!selectedUserId) return;

    const currentMessages = get().messagesByUserId[selectedUserId] || [];

    const updatedMessages = currentMessages.map((msg) =>
      String(msg._id) === String(updatedMessage._id)
        ? {
            ...msg,
            reactions: updatedMessage.reactions, 
          }
        : msg
    );

    set({
      messagesByUserId: {
        ...get().messagesByUserId,
        [selectedUserId]: updatedMessages,
      },
    });
  });
},

  // Unsubscribe from Messages
  unsubscribeFromMessages: () => {
  const { socket } = useAuthStore.getState();
  if (socket) {
    socket.off("newMessage");
    socket.off("reactionUpdated"); 
  }
},

  clearMessagesForUser: (userId) => {
    if (!userId) return;
    
    set(state => {
      const { [userId]: _, ...remainingMessages } = state.messagesByUserId;
      return { messagesByUserId: remainingMessages };
    });
  },

  // Edit Message
  editMessage: async (messageId, newText) => {
  const { selectedUser } = get();
  const { socket } = useAuthStore.getState();

  if (!selectedUser) {
    toast.error("No user selected");
    return;
  }

  const userId = String(selectedUser._id);

  try {
    await axiosInstance.put(`/messages/edit/${messageId}`, {
      text: newText
    });

    const currentMessages = get().messagesByUserId[userId] || [];

    const updatedMessages = currentMessages.map(msg =>
      String(msg._id) === String(messageId)
        ? {
            ...msg,
            text: newText,
            editedAt: new Date().toISOString()
          }
        : msg
    );

    set({
      messagesByUserId: {
        ...get().messagesByUserId,
        [userId]: updatedMessages
      }
    });

    socket.emit("editMessage", {
      messageId,
      newText,
    });

    toast.success("Message edited");

  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to edit message");
  }
},

  // Subscribe to message edits
 subscribeToMessageEdits: () => {
  const { socket } = useAuthStore.getState();

  if (!socket) return;

  socket.off("messageEdited");

  socket.on("messageEdited", (editedMessage) => {
    const state = get();

    const allChats = { ...state.messagesByUserId };

    Object.keys(allChats).forEach((chatId) => {
      allChats[chatId] = allChats[chatId].map((msg) =>
        String(msg._id) === String(editedMessage._id)
          ? {
              ...msg,
              text: editedMessage.text,
              editedAt: editedMessage.editedAt,
            }
          : msg
      );
    });

    set({
      messagesByUserId: allChats,
    });
  });
},

  // Reset Entire Chat State
  resetChatState: () => {
    set({
      allContacts: [],
      chats: [],
      messagesByUserId: {},
      activeTab: "chats",
      selectedUser: null,
      isUsersLoading: false,
      isMessagesLoading: false,
    });
  },

  // Delete Message
deleteMessage: async (messageId, forEveryone = false) => {
  try {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;

    if (!selectedUser) return;

    const userId = String(selectedUser._id);

    const res = await axiosInstance.delete(
      `/messages/delete/${messageId}`,
      {
        data: { forEveryone },
      }
    );

    const payload = res.data;
console.log("Delete response:", payload);
    if (socket) {
      socket.emit("messageDeleted", {
        messageId,
        forEveryone,
        receiverId: userId,
      });
    }

    set((state) => {
      const currentMessages = state.messagesByUserId[userId] || [];

      const updatedMessages = currentMessages.map((msg) => {
        if (String(msg._id) !== String(messageId)) return msg;

        if (forEveryone) {
          return {
            ...msg,
            isDeleted: true,
            text: "🗑️ This message was deleted",
            attachment: null,
            image: null,
            reactions: [],
          };
        }

        return {
          ...msg,
          deletedFor: [
            ...(msg.deletedFor || []),
            String(useAuthStore.getState().authUser?._id),
          ],
        };
      });

      return {
        messagesByUserId: {
          ...state.messagesByUserId,
          [userId]: updatedMessages,
        },
      };
    });

    toast.success(
      forEveryone ? "Deleted for everyone" : "Deleted for you"
    );
  } catch (error) {
    console.error("Delete error:", error);
    toast.error("Delete failed");
  }
},

addReaction: async (messageId, emoji) => {
  try {
    await axiosInstance.post(`/messages/reaction/${messageId}`, { emoji });
  } catch (error) {
    toast.error(error.response?.data?.message || "Failed to add reaction");
  }
},
removeReaction: async (messageId, emoji, receiverId) => {
  try {
    const res = await axiosInstance.delete(
      `/messages/reaction/${messageId}/${emoji}`,
      {
        data: { receiverId },
      }
    );

    const updatedMsg = res.data;

    set((state) => ({
      messagesByUserId: {
        ...state.messagesByUserId,
        [receiverId]: state.messagesByUserId[receiverId].map((msg) =>
          msg._id === messageId ? updatedMsg : msg
        ),
      },
    }));
  } catch (error) {
    toast.error(
      error.response?.data?.message || "Failed to remove reaction"
    );
  }
},
  markMessagesAsRead: async (chatUserId) => {
    try {
      await axiosInstance.put(`/messages/read/${chatUserId}`);
      
      const userId = String(chatUserId);
      const currentMessages = get().messagesByUserId[userId] || [];
      const updatedMessages = currentMessages.map(msg => ({
        ...msg,
        isRead: true,
        status: "seen",
        seenAt: new Date().toISOString()
      }));
      
      set({
        messagesByUserId: {
          ...get().messagesByUserId,
          [userId]: updatedMessages
        }
      });
      
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  },


subscribeToMessagesSeen: () => {
  const { socket } = useAuthStore.getState();
  if (!socket) return;
  
  socket.off("messagesSeen");
  socket.on("messagesSeen", ({ chatId, seenAt }) => {    
    const chatMessages = get().messagesByUserId[chatId] || [];
    const updatedMessages = chatMessages.map(msg => ({
      ...msg,
      isRead: true,
      status: "seen",
      seenAt: seenAt
    }));
    
    set({
      messagesByUserId: {
        ...get().messagesByUserId,
        [chatId]: updatedMessages
      }
    });
    
  });
},

  // Mark Current Chat as Read
  markCurrentChatAsRead: () => {
    const { selectedUser } = get();
    if (selectedUser && selectedUser._id) {
      get().markMessagesAsRead(selectedUser._id);
    }
  },

 // Subscribe to Message Deletions
  subscribeToMessageDeletions: () => {
  const { socket, authUser } = useAuthStore.getState();
  if (!socket) return;

  socket.off("messageDeleted");
  socket.on("messageDeleted", ({ messageId, text, deletedBy }) => {

    const allChats = get().messagesByUserId;
    const updatedChats = {};

    Object.keys(allChats).forEach(userId => {
      updatedChats[userId] = allChats[userId].map(msg =>
        String(msg._id) === String(messageId)
          ? {
              ...msg,
              text:
                deletedBy === String(authUser._id)
                  ? "🧹 You wiped this message"
                  : text || "💨 Message disappeared",
              isDeleted: true,
              attachment: null,
              image: null
            }
          : msg
      );
    });

    set({ messagesByUserId: updatedChats });
  });

  socket.off("messageDeletedForMe");
  socket.on("messageDeletedForMe", ({ messageId }) => {

    const allChats = get().messagesByUserId;
    const updatedChats = {};

    Object.keys(allChats).forEach(userId => {
      updatedChats[userId] = allChats[userId].filter(
        msg => String(msg._id) !== String(messageId)
      );
    });

    set({ messagesByUserId: updatedChats });
  });
},

// Reply to Message
replyToMessage: async (messageId, replyText, originalMessage) => {
  const { selectedUser } = get();
  const { authUser } = useAuthStore.getState();

  if (!selectedUser) {
    toast.error("No user selected");
    return;
  }

  const userId = String(selectedUser._id);
  const tempId = `temp-reply-${Date.now()}-${Math.random()}`;
  const currentUserId = String(authUser._id);

  const optimisticReply = {
    _id: tempId,
    senderId: currentUserId,
    receiverId: userId,
    text: replyText,
    image: null,
    createdAt: new Date().toISOString(),
    isOptimistic: true,
    status: 'sent',
    isReply: true,
    replyTo: {
      messageId: originalMessage._id,
      text: originalMessage.text,
      senderName: originalMessage.senderId === currentUserId ? "You" : selectedUser.fullName,
      image: originalMessage.image
    }
  };

  const currentMessages = get().messagesByUserId[userId] || [];

  set({
    messagesByUserId: {
      ...get().messagesByUserId,
      [userId]: [...currentMessages, optimisticReply],
    }
  });

  try {
    const res = await axiosInstance.post(`/messages/send/${userId}`, {
      text: replyText,
      replyToMessageId: messageId
    });

    const newMsg = {
      ...res.data,
      _id: String(res.data._id),
      senderId: String(res.data.senderId),
      receiverId: String(res.data.receiverId),
      text: res.data.text || "",
      image: res.data.attachment?.url || null,
      createdAt: res.data.createdAt,
      isOptimistic: false,
      reactions: res.data.reactions || [],
      status: res.data.status || 'sent',
      isReply: true,
      replyTo: {
        messageId: originalMessage._id,
        text: originalMessage.text,
        senderName: originalMessage.senderId === currentUserId ? "You" : selectedUser.fullName,
        image: originalMessage.image
      }
    };

    const updatedMessages = (get().messagesByUserId[userId] || []).filter(
      msg => !msg.isOptimistic || msg._id !== tempId
    );
    updatedMessages.push(newMsg);

    set({
      messagesByUserId: {
        ...get().messagesByUserId,
        [userId]: updatedMessages,
      }
    });

  

  }
   catch (error) {
    console.error("replyToMessage error:", error);
    toast.error("Failed to send reply");

    const messagesWithoutOptimistic = (get().messagesByUserId[userId] || []).filter(
      msg => !msg.isOptimistic || msg._id !== tempId
    );

    set({
      messagesByUserId: {
        ...get().messagesByUserId,
        [userId]: messagesWithoutOptimistic,
      }
    });
  }
},
}));