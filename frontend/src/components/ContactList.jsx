import { useEffect, useCallback, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { useAuthStore } from "../store/useAuthStore";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading, activeTab } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  const handleContactClick = useCallback((contact) => {
    if (!contact || !contact._id) return;
    if (isProcessingRef.current) return; 
    
    isProcessingRef.current = true;
    
    
    if (activeTab === "contacts") {
      setSelectedUser(contact);
    }
    
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 300);
  }, [setSelectedUser, activeTab]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;

  if (!allContacts || allContacts.length === 0) {
    return (
      <div className="text-center text-slate-400 py-8">
        No contacts found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allContacts.map((contact) => (
        <div
          key={contact._id}
          className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
          onClick={() => handleContactClick(contact)}
        >
          <div className="flex items-center gap-3">
            <div className={`avatar ${onlineUsers?.includes(contact._id) ? "online" : "offline"}`}>
              <div className="size-12 rounded-full overflow-hidden">
                <img 
                  src={contact.profilePic || "/avatar.png"} 
                  alt={contact.fullName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div>
              <h4 className="text-slate-200 font-medium">{contact.fullName}</h4>
              <p className="text-xs text-slate-400">
                {onlineUsers?.includes(contact._id) ? "🟢 Online" : "⚫ Offline"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ContactList;