import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (message: any) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      // Initialize socket connection
      const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
        auth: {
          token,
        },
        transports: ['websocket'],
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        setIsConnected(true);
        console.log('Connected to server');
        
        // Join user-specific room
        newSocket.emit('join-agent-room', {
          userType: user.role.toLowerCase(),
          userId: user.id,
        });
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
        console.log('Disconnected from server');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        toast.error('Connection error. Please check your internet connection.');
      });

      // AI Agent message handlers
      newSocket.on('ai-response', (data) => {
        // Handle AI agent responses
        console.log('AI Response:', data);
      });

      newSocket.on('ai-error', (error) => {
        console.error('AI Error:', error);
        toast.error('AI service error. Please try again.');
      });

      newSocket.on('agent-notification', (notification) => {
        // Handle inter-agent notifications
        console.log('Agent Notification:', notification);
        
        if (notification.messageType === 'alert') {
          toast(notification.content);
        }
      });

      newSocket.on('system-alert', (alert) => {
        // Handle system alerts (for admins)
        if (user.role === 'ADMIN') {
          toast.error(`System Alert: ${alert.title}`);
        }
      });

      newSocket.on('emergency-alert', (alert) => {
        // Handle emergency alerts (for doctors)
        if (user.role === 'DOCTOR') {
          toast.error(`🚨 Emergency: ${alert.content}`, {
            duration: 10000,
          });
        }
      });

      newSocket.on('agent-message', (message) => {
        // Handle direct agent-to-agent messages
        console.log('Agent Message:', message);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    }
  }, [user, token]);

  const sendMessage = (message: any) => {
    if (socket && isConnected) {
      socket.emit('ai-message', message);
    } else {
      toast.error('Not connected to server');
    }
  };

  const joinRoom = (roomId: string) => {
    if (socket && isConnected) {
      socket.emit('join-room', roomId);
    }
  };

  const leaveRoom = (roomId: string) => {
    if (socket && isConnected) {
      socket.emit('leave-room', roomId);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    sendMessage,
    joinRoom,
    leaveRoom,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
