import axios from "axios";

// Detect environment
const isDevelopment = import.meta.env.MODE === "development";
const apiUrl = isDevelopment 
  ? "http://localhost:3000" 
  : import.meta.env.VITE_API_URL || "https://chat-application-7ttg.vercel.app";

export const axiosInstance = axios.create({
  baseURL: `${apiUrl}/api`,
  withCredentials: true, // IMPORTANT: Cookies send/receive
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  timeout: 30000, // 30 seconds timeout
});

// Request Interceptor - Add token from localStorage as backup
axiosInstance.interceptors.request.use(
  (config) => {
    // For debugging
    console.log(`📤 ${config.method.toUpperCase()} ${config.url}`);
    
    // If you're using localStorage token as backup
    const token = localStorage.getItem("jwt_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add withCredentials to every request
    config.withCredentials = true;
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - Handle 401 errors
axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      console.error("🔒 Unauthorized - Redirecting to login");
      localStorage.removeItem("jwt_token");
      // Redirect to login if not already there
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    
    if (error.response?.status === 403) {
      console.error("⛔ Forbidden - Access denied");
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;