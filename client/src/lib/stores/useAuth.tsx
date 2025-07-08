import { create } from "zustand";
import { apiRequest } from "../queryClient";
import { toast } from "sonner";
import { InsertUser, LoginUser, User, UpdateProfile } from "@shared/schema";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginUser) => Promise<void>;
  register: (userData: InsertUser) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (userId: number, data: UpdateProfile) => Promise<User>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (credentials) => {
    try {
      set({ isLoading: true, error: null });
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      const userData = await response.json();
      set({ user: userData, isAuthenticated: true, isLoading: false });
      toast.success("Login successful!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  register: async (userData) => {
    try {
      set({ isLoading: true, error: null });
      const response = await apiRequest("POST", "/api/auth/register", userData);
      const user = await response.json();
      set({ user, isAuthenticated: true, isLoading: false });
      toast.success("Registration successful!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      await apiRequest("POST", "/api/auth/logout", {});
      set({ user: null, isAuthenticated: false, isLoading: false });
      toast.success("Logged out successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logout failed";
      set({ error: message, isLoading: false });
      toast.error(message);
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const response = await apiRequest("GET", "/api/auth/me", undefined);
      const userData = await response.json();
      set({ user: userData, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      // Don't show error toast for auth check - this is expected for non-logged in users
    }
  },

  updateProfile: async (userId, data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await apiRequest(
        "PATCH", 
        `/api/users/${userId}/profile`, 
        data
      );
      const updatedUser = await response.json();
      
      // Update the user state with the new data
      set({ 
        user: updatedUser, 
        isLoading: false 
      });
      
      return updatedUser;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile";
      set({ error: message, isLoading: false });
      throw error;
    }
  },
  
  clearError: () => set({ error: null }),
}));
