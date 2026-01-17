import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeStorageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

interface User {
  id: string;
  email: string;
  phone: string;
  role: 'PATIENT' | 'DOCTOR' | 'AMBULANCE' | 'ADMIN';
  profile: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  updateProfile: (profileData: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_PROFILE'; payload: User };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, loading: true };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        loading: false,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        loading: false,
        user: null,
        token: null,
        isAuthenticated: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
};

const initialState: AuthState = {
  user: null,
  token: safeStorageGet('token'),
  loading: false,
  isAuthenticated: false,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Configure axios defaults
  useEffect(() => {
    // Set base URL for all axios requests
    const apiUrl = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3000';
    axios.defaults.baseURL = apiUrl;
    
    if (state.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [state.token]);

  // Check for existing token on mount
  useEffect(() => {
    const token = safeStorageGet('token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: response.data.data.user,
          token,
        },
      });
    } catch (error) {
      safeStorageRemove('token');
      dispatch({ type: 'AUTH_FAILURE' });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      const { user, token } = response.data.data;

      safeStorageSet('token', token);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });

      toast.success(`Welcome back, ${user.profile.firstName}! Session will persist until you log out.`);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (userData: any) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
            // Transform fields to match backend expectations
      const payload: any = { ...userData, phone: userData.phoneNumber, emergencyContact: userData.phoneNumber };
      delete payload.phoneNumber;
      delete payload.confirmPassword;
      if (payload.role && typeof payload.role === 'string') {
        payload.role = payload.role.toUpperCase();
      }

      const response = await axios.post('/api/auth/register', payload);
      
      const { user, token } = response.data.data;
      
      safeStorageSet('token', token);
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });

      toast.success(`Welcome to AuraMed, ${user.profile.firstName}! Your session will persist until you log out.`);
    } catch (error: any) {
      dispatch({ type: 'AUTH_FAILURE' });
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear token and state immediately to prevent further requests
      safeStorageRemove('token');
      dispatch({ type: 'LOGOUT' });
      
      // Then attempt API logout (but don't wait for it)
      axios.post('/api/auth/logout').catch(() => {
        // Ignore errors - user is already logged out locally
      });
      
      toast.success('Logged out successfully');
    } catch (error) {
      // Always complete logout even if API call fails
      safeStorageRemove('token');
      dispatch({ type: 'LOGOUT' });
      toast.success('Logged out successfully');
    }
  };

  const updateProfile = async (profileData: any) => {
    try {
      const response = await axios.put('/api/auth/profile', profileData);
      
      dispatch({
        type: 'UPDATE_PROFILE',
        payload: response.data.data.user,
      });

      toast.success('Profile updated successfully');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      throw error;
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };
