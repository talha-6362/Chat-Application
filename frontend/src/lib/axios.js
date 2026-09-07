import axios from "axios";

export const axiosInstance = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:3000/api"
      : import.meta.env.VITE_API_URL 
      ? `${import.meta.env.VITE_API_URL}/api`
      : "https://chat-application-7ttg.vercel.app/api",
  withCredentials: true,
});