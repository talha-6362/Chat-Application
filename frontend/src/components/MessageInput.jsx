import { useRef, useState, useEffect } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import { ImageIcon, SendIcon, XIcon } from "lucide-react";

function MessageInput({ replyTo, onSendReply, onReplySent }) {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const { sendMessage, isSoundEnabled } = useChatStore();

  // Focus when replying
  useEffect(() => {
    if (replyTo) {
      inputRef.current?.focus();
    }
  }, [replyTo]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (replyTo && onSendReply) {
      if (!text.trim() && !imageFile) return;
      if (isSoundEnabled) playRandomKeyStrokeSound();
      
      const messageData = {
        text: text.trim(),
        replyToMessageId: replyTo._id
      };
      
      if (imageFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendMessage({
            ...messageData,
            image: reader.result,
          });
        };
        reader.readAsDataURL(imageFile);
      } else {
        await sendMessage(messageData);
      }
      
      setText("");
      setImagePreview(null);
      setImageFile(null);
      if (onReplySent) onReplySent();
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    
    if (!text.trim() && !imageFile) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    const messageData = { text: text.trim() };

    if (imageFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        sendMessage({
          ...messageData,
          image: reader.result,
        });
      };
      reader.readAsDataURL(imageFile);
    } else {
      sendMessage(messageData);
    }

    setText("");
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setImageFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
      {/* Image Preview */}
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (isSoundEnabled) playRandomKeyStrokeSound();
          }}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-full py-3 px-5 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
          placeholder={replyTo ? "Type your reply..." : "Type your message..."}
        />

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-full p-3 transition-colors ${
            imagePreview ? "text-cyan-500" : ""
          }`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        
        <button
          type="submit"
          disabled={!text.trim() && !imageFile}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-full p-3 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;