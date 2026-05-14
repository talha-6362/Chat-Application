import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import DeleteConfirmDialog from './DeleteConfirmDialog';
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";

function ChatContainer() {

  const {
    selectedUser,
    getMessagesByUserId,
    messagesByUserId,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
    subscribeToMessageEdits,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    subscribeToMessageDeletions
  } = useChatStore();
  const { authUser, socket } = useAuthStore();

  const messageEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  
  const [menuMessageId, setMenuMessageId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    messageId: null,
    forEveryone: false
  });

  const selectedUserId = selectedUser?._id ? String(selectedUser._id) : null;
  const authUserId = authUser?._id ? String(authUser._id) : null;

  const messages = useMemo(() => {
    if (!selectedUserId) return [];
    const rawMessages = messagesByUserId[selectedUserId] || [];
    return rawMessages.map((m) => ({
      ...m,
      replyTo: m.replyTo ? {
        messageId: m.replyTo.messageId,
        text: m.replyTo.text,
        senderName: m.replyTo.senderName,
        image: m.replyTo.image
      } : null
    }));
  }, [selectedUserId, messagesByUserId]);

  const loadMessages = useCallback(async () => {
    if (!selectedUser) return;
    await getMessagesByUserId(selectedUser._id);
  }, [selectedUser, getMessagesByUserId]);

  const markUnreadMessagesAsSeen = useCallback(() => {
    if (!socket || !selectedUserId) return;

    const unreadMessages = messages.filter(m => 
      !m.isRead && 
      String(m.senderId?._id || m.senderId) === selectedUserId
    );

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(m => m._id);
      
      socket.emit("markAsRead", {
        chatId: selectedUserId,
        messageIds
      });

      useChatStore.setState((state) => {
        const currentMessages = state.messagesByUserId[selectedUserId] || [];
        const updatedMessages = currentMessages.map(msg =>
          messageIds.includes(msg._id) 
            ? { ...msg, isRead: true, status: "seen" }
            : msg
        );

        return {
          messagesByUserId: {
            ...state.messagesByUserId,
            [selectedUserId]: updatedMessages
          }
        };
      });
    }
  }, [socket, selectedUserId, messages]);

  useEffect(() => {
    if (messages.length > 0 && selectedUserId) {
      markUnreadMessagesAsSeen();
    }
  }, [messages, selectedUserId, markUnreadMessagesAsSeen]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      if (selectedUserId && String(newMessage.senderId?._id || newMessage.senderId) === selectedUserId) {
        setTimeout(() => {
          markUnreadMessagesAsSeen();
        }, 100);
      }
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, selectedUserId, markUnreadMessagesAsSeen]);
useEffect(() => {
  subscribeToMessageDeletions();
}, []);
useEffect(() => {
  subscribeToMessageEdits();
}, []);
  const handleUserScroll = () => {
    setIsUserScrolling(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 1500);
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleUserScroll);
      return () => {
        container.removeEventListener('scroll', handleUserScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, []);
  
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const lastMsg = messages[messages.length - 1];
    const isMyLastMessage =
      lastMsg && String(lastMsg.senderId) === String(authUserId);

    if (isMyLastMessage) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!isUserScrolling) {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  useEffect(() => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, [selectedUserId]);
  
  useEffect(() => {
    if (!socket) return;

    const handleMessagesSeen = ({ chatId, messageIds }) => {
      if (String(chatId) === String(selectedUserId)) {
        useChatStore.setState((state) => {
          const currentMessages = state.messagesByUserId[chatId] || [];
          const updatedMessages = currentMessages.map(msg =>
            messageIds.includes(msg._id)
              ? { ...msg, isRead: true, status: "seen" }
              : msg
          );

          return {
            messagesByUserId: {
              ...state.messagesByUserId,
              [chatId]: updatedMessages
            }
          };
        });
      }
    };

    socket.on("messagesSeen", handleMessagesSeen);

    return () => {
      socket.off("messagesSeen", handleMessagesSeen);
    };
  }, [socket, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;

    subscribeToMessages();

    return () => {
      unsubscribeFromMessages();
    };
  }, [selectedUserId, subscribeToMessages, unsubscribeFromMessages]);

  const handleEditMessage = async () => {
    if (!editText.trim() || !editingMessageId) return;
    await editMessage(editingMessageId, editText.trim());
    setEditingMessageId(null);
    setEditText("");
  };

  const handleDeleteMessage = (messageId, forEveryone) => {
    setDeleteDialog({
      isOpen: true,
      messageId: messageId,
      forEveryone: forEveryone
    });
    setMenuMessageId(null);
  };

  const handleConfirmDelete = async () => {
    await deleteMessage(deleteDialog.messageId, deleteDialog.forEveryone);
    setDeleteDialog({ isOpen: false, messageId: null, forEveryone: false });
    
    setMenuMessageId(null);
    setShowReactionPicker(null);
  };

  const handleReaction = async (messageId, emoji) => {
    await addReaction(messageId, emoji);
    setShowReactionPicker(null);
    setMenuMessageId(null);
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    await removeReaction(messageId, emoji, selectedUser._id);
  };

  const handleSendReply = async (replyText, originalMessage) => {
    if (!replyText.trim()) return;
    
    const messageData = {
      text: replyText.trim(),
      replyToMessageId: originalMessage._id
    };
    
    const { sendMessage } = useChatStore.getState();
    await sendMessage(messageData);
    setReplyingTo(null);
  };

  const getMessageReactions = (message) => {
    if (!message.reactions || message.reactions.length === 0) return null;
    
    const grouped = message.reactions.reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(grouped).map(([emoji, count]) => ({ emoji, count }));
  };

  const isDeletedForCurrentUser = (msg) => {
    if (!authUser?._id) return false;
    return msg.deletedFor?.includes(authUser._id);
  };

  const getMessageStatus = (msg, isMyMessage) => {
    if (!isMyMessage) return null;

    if (msg.status === "seen" || msg.isRead === true) {
      return <span className="text-green-500 text-[11px] ml-1">✓✓</span>;
    }

    if (msg.status === "delivered") {
      return <span className="text-gray-400 text-[11px] ml-1">✓✓</span>;
    }

    return <span className="text-gray-400 text-[11px] ml-1">✓</span>;
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-center text-slate-400">
          Select a chat to start messaging
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto px-4 py-4" ref={messagesContainerRef}>
        {isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((msg) => {
              const deletedForMe = isDeletedForCurrentUser(msg);
              
              if (deletedForMe) return null;
              
              const isMyMessage = String(msg.senderId?._id || msg.senderId) === String(authUserId);
              const isDeletedForEveryone = msg.isDeleted === true;
              const messageReactions = getMessageReactions(msg);
              const isEditing = editingMessageId === msg._id;
              
              return (
                <div
                  key={msg._id}
                  className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className={`relative max-w-[75%] ${isMyMessage ? 'items-end' : 'items-start'}`}>
                    
                    {!isDeletedForEveryone && (
                      <button
                        onClick={() => setMenuMessageId(menuMessageId === msg._id ? null : msg._id)}
                        className={`absolute -top-2 z-10 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity ${
                          isMyMessage ? '-left-8' : '-right-8'
                        }`}
                      >
                        ⋮
                      </button>
                    )}

                    {/* Menu Dropdown */}
                    {menuMessageId === msg._id && (
                      <>
                        <div 
                          className="fixed inset-0 z-20" 
                          onClick={() => setMenuMessageId(null)}
                        />
                        <div className={`absolute top-5 z-30 bg-slate-800 rounded-lg shadow-lg border border-slate-700 min-w-[160px] overflow-hidden ${
                          isMyMessage ? 'right-0' : 'left-0'
                        }`}>
                          <button
                            onClick={() => {
                              setShowReactionPicker(msg._id);
                              setMenuMessageId(null);
                            }}
                            className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 text-white"
                          >
                            <span className="text-lg">😊</span>
                            <span>Add Reaction</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setReplyingTo(msg);
                              setMenuMessageId(null);
                            }}
                            className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 text-white"
                          >
                            <span className="text-lg">↩️</span>
                            <span>Reply</span>
                          </button>
                          
                          {isMyMessage && !isDeletedForEveryone && (
                            <button
                              onClick={() => {
                                setEditingMessageId(msg._id);
                                setEditText(msg.text || "");
                                setMenuMessageId(null);
                              }}
                              className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 text-white"
                            >
                              <span className="text-lg">✏️</span>
                              <span>Edit Message</span>
                            </button>
                          )}
                          
                          {/* Delete Options */}
                          {isMyMessage && !isDeletedForEveryone && (
                            <button
                              onClick={() => handleDeleteMessage(msg._id, true)}
                              className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 text-red-400"
                            >
                              <span className="text-lg">🗑️</span>
                              <span>Delete for everyone</span>
                            </button>
                          )}
                          
                          {!isDeletedForEveryone && (
                            <button
                              onClick={() => handleDeleteMessage(msg._id, false)}
                              className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 text-white"
                            >
                              <span className="text-lg">🗑️</span>
                              <span>Delete for me</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {/* Reaction Picker */}
                    {showReactionPicker === msg._id && (
                      <>
                        <div 
                          className="fixed inset-0 z-20" 
                          onClick={() => setShowReactionPicker(null)}
                        />
                        <div className={`absolute -bottom-12 z-30 ${
                          isMyMessage ? 'right-0' : 'left-0'
                        }`}>
                          <div className="flex gap-1 p-2 bg-slate-800 rounded-full shadow-lg border border-slate-700">
                            {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg._id, emoji)}
                                className="w-8 h-8 text-xl hover:scale-125 transition-transform hover:bg-slate-700 rounded-full flex items-center justify-center"
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              onClick={() => setShowReactionPicker(null)}
                              className="w-8 h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded-full flex items-center justify-center"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isMyMessage
                          ? "bg-cyan-600 text-white rounded-br-sm"
                          : "bg-slate-700 text-slate-200 rounded-bl-sm"
                      } ${isDeletedForEveryone ? "opacity-80" : ""}`}
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="bg-slate-600 rounded-lg px-3 py-2 text-white w-full"
                            autoFocus
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={handleEditMessage}
                              className="px-3 py-1 bg-green-600 rounded-lg text-sm text-white"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditText("");
                              }}
                              className="px-3 py-1 bg-red-600 rounded-lg text-sm text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Reply Preview - Hide if deleted */}
                          {msg.replyTo && !isDeletedForEveryone && (
                            <div className={`text-xs mb-2 p-2 rounded ${
                              isMyMessage ? 'bg-cyan-700' : 'bg-slate-600'
                            } border-l-2 border-cyan-400`}>
                              <p className="font-medium text-cyan-300 text-[10px]">
                                ↪️ Replying to {msg.replyTo.senderName || (msg.replyTo.senderId === authUserId ? "You" : selectedUser?.fullName)}
                              </p>
                              <p className="text-xs truncate opacity-75">
                                {msg.replyTo.text?.substring(0, 50) || (msg.replyTo.image ? "📷 Photo" : "Media message")}
                              </p>
                            </div>
                          )}

                          {/* Image Attachment - Hide if deleted */}
                          {msg.image && !isDeletedForEveryone && (
                            <img
                              src={msg.image}
                              alt="Shared"
                              className="rounded-lg max-h-48 object-cover cursor-pointer mb-2"
                              onClick={() => window.open(msg.image, "_blank")}
                            />
                          )}

                          {/* Message Text or Deleted Message */}
                          {isDeletedForEveryone ? (
                            <div className="text-sm italic text-center">
                              {isMyMessage ? (
                                <p className="text-cyan-200">
                                  🗑️ You deleted this message
                                </p>
                              ) : (
                                <p className="text-yellow-200">
                                  🗑️ This message was deleted
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                          )}

                          {/* Edited Indicator */}
                          {msg.editedAt && !isDeletedForEveryone && (
                            <span className="text-[10px] opacity-50 ml-1">edited</span>
                          )}

                          {/* Reactions - Only show if not deleted */}
                          {!isDeletedForEveryone && Array.isArray(messageReactions) &&
                            messageReactions.map(({ emoji, count }) => {
                              const isOwner = msg.reactions?.some(
                                (r) =>
                                  r.userId === authUser?._id &&
                                  r.emoji === emoji
                              );
                              return (
                                <button
                                  key={emoji}
                                  onClick={() =>
                                    isOwner && handleRemoveReaction(msg._id, emoji)
                                  }
                                  disabled={!isOwner}
                                  className={`text-xs rounded-full px-2 py-0.5 flex items-center gap-1 mt-1 ${
                                    isOwner
                                      ? "bg-black/20 hover:bg-black/30"
                                      : "bg-gray-400/20 cursor-not-allowed opacity-60"
                                  }`}
                                >
                                  {emoji} {count > 1 ? count : ""}
                                </button>
                              );
                            })}
                          
                          {/* Time and Status */}
                          <div className="flex justify-end items-center gap-1 mt-1">
                            <span className="text-[10px] opacity-70">
                              {formatTime(msg.createdAt)}
                            </span>
                            {!isDeletedForEveryone && getMessageStatus(msg, isMyMessage)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser.fullName} />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, messageId: null, forEveryone: false })}
        onConfirm={handleConfirmDelete}
        isForEveryone={deleteDialog.forEveryone}
      />

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="px-4 pt-2">
          <div className="bg-slate-800 rounded-lg p-2 mb-2 flex justify-between items-center border-l-4 border-cyan-500">
            <div className="flex-1">
              <p className="text-xs text-cyan-400">Replying to {replyingTo.senderId === authUserId ? "yourself" : selectedUser?.fullName}</p>
              <p className="text-sm text-slate-300 truncate">
                {replyingTo.text?.substring(0, 50) || (replyingTo.image ? "📷 Photo" : "Media message")}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      <MessageInput 
        replyTo={replyingTo}
        onSendReply={handleSendReply}
        onReplySent={() => setReplyingTo(null)}
      />
    </div>
  );
}

export default ChatContainer;