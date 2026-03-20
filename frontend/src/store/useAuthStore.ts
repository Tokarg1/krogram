import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number;
  phone?: string | null;
  username: string;
  avatar_url?: string;
  bio?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
        localStorage.removeItem('auth-storage'); // Explicitly clear if needed
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
