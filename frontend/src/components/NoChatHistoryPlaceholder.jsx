import { MessageCircleIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";

const NoChatHistoryPlaceholder = ({ name }) => {
  const { sendMessage, selectedUser, isSoundEnabled } = useChatStore();
  const { authUser } = useAuthStore();

  const handleSuggestionClick = async (messageText) => {
    if (!selectedUser) {
      toast.error("No user selected");
      return;
    }

    if (!authUser) {
      toast.error("You are not logged in");
      return;
    }

    if (isSoundEnabled) {
      const clickSound = new Audio("/sounds/click.mp3");
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
    }

    // Send the message
    await sendMessage({
      text: messageText,
      image: null,
    });

    toast.success("Message sent!");
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-full flex items-center justify-center mb-5">
        <MessageCircleIcon className="size-8 text-cyan-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-200 mb-3">
        Start your conversation with {name}
      </h3>
      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-slate-400 text-sm">
          This is the beginning of your conversation. Send a message to start chatting!
        </p>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent mx-auto"></div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <button 
          onClick={() => handleSuggestionClick("👋 Hello! How are you?")}
          className="px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full hover:bg-cyan-500/20 transition-colors"
        >
          👋 Say Hello
        </button>
        <button 
          onClick={() => handleSuggestionClick("🤝 How are you doing today?")}
          className="px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full hover:bg-cyan-500/20 transition-colors"
        >
          🤝 How are you?
        </button>
        <button 
          onClick={() => handleSuggestionClick("📅 Would you like to meet up soon?")}
          className="px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full hover:bg-cyan-500/20 transition-colors"
        >
          📅 Meet up soon?
        </button>
      </div>
    </div>
  );
};

export default NoChatHistoryPlaceholder;