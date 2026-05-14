import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useChatStore } from "./useChatStore"; 

const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:3000"
    : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  socket: null,
  onlineUsers: [],
  navigate: null,

  setNavigate: (navigate) => set({ navigate }),

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check", {
        withCredentials: true,
      });
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in authCheck:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  // SIGNUP
  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      await axiosInstance.post("/auth/signup", data, {
        withCredentials: true,
      });

      toast.success("Account created successfully! Please log in.");

      const navigate = get().navigate;
      if (navigate) navigate("/login");
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  // LOGIN
  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data, {
        withCredentials: true,
      });
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  // LOGOUT 
  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout", {}, { withCredentials: true });
      
      const { resetChatState, unsubscribeFromMessages } = useChatStore.getState();
      if (resetChatState) {
        resetChatState();
      }
      if (unsubscribeFromMessages) {
        unsubscribeFromMessages();
      }
      
      set({ authUser: null, onlineUsers: [] });
      get().disconnectSocket();
      toast.success("Logged out successfully");
      
      const navigate = get().navigate;
      if (navigate) navigate("/login");
    } catch (error) {
      console.log("Logout error:", error);
      toast.error("Error logging out");
    }
  },

  // UPDATE PROFILE
  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", data, {
        withCredentials: true,
      });
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("Error in updateProfile:", error);
      toast.error(error.response?.data?.message || "Profile update failed");
    }
  },

  // SOCKET MANAGEMENT 
  connectSocket: () => {
    const { authUser, socket } = get();
    
    if (!authUser) return;
    if (socket?.connected) return;
    
    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(BASE_URL, { 
      withCredentials: true,
      transports: ['websocket'], 
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    newSocket.connect();
    set({ socket: newSocket });

    newSocket.on("connect", () => {
    });

    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    newSocket.on("disconnect", () => {
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
  },

  // DISCONNECT SOCKET 
  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.off("connect");
      socket.off("getOnlineUsers");
      socket.off("disconnect");
      socket.off("connect_error");
      
      socket.disconnect();
      set({ socket: null });
    }
  },


  reconnectSocket: () => {
    get().disconnectSocket();
    setTimeout(() => {
      get().connectSocket();
    }, 1000);
  },
}));