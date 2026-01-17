import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useI18n } from '../contexts/I18nContext';
import { 
  PaperAirplaneIcon, 
  MicrophoneIcon,
  StopIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  messageType?: string;
  metadata?: any;
}

const AIChat: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected, sendMessage } = useSocket();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, []);

  // Listen for AI responses via socket
  useEffect(() => {
    if (socket) {
      socket.on('ai-response', handleAIResponse);
      socket.on('ai-error', handleAIError);
      
      return () => {
        socket.off('ai-response', handleAIResponse);
        socket.off('ai-error', handleAIError);
      };
    }
  }, [socket]);

  const loadChatHistory = async () => {
    try {
      const response = await axios.get('/api/ai-agents/chat/history?limit=50');
      const history = response.data.data.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.fromUserId === user?.id ? 'user' : 'ai',
        timestamp: new Date(msg.createdAt),
        messageType: msg.messageType,
        metadata: msg.metadata
      }));
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Continue without history if API fails
    }
  };

  const handleAIResponse = (data: any) => {
    const aiMessage: Message = {
      id: data.message?.id || `ai_${Date.now()}`,
      content: data.message?.content || data.content || 'AI response received',
      sender: 'ai',
      timestamp: new Date(),
      messageType: data.message?.messageType || data.messageType,
      metadata: data.message?.metadata || data.metadata
    };
    
    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  };

  const handleAIError = (error: any) => {
    toast.error('AI service error. Please try again.');
    setIsLoading(false);
  };

  const sendChatMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      content: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Send via socket for real-time response
      if (isConnected && socket) {
        sendMessage({
          userId: user?.id,
          content: inputMessage,
          messageType: 'text',
          agentType: user?.role.toLowerCase()
        });
      } else {
        // Fallback to HTTP API
        const response = await axios.post('/api/ai-agents/chat', {
          message: inputMessage,
          messageType: 'text'
        });
        
        handleAIResponse({ message: response.data.data.message });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send message');
      setIsLoading(false);
    }

    setInputMessage('');
  };

  const analyzeSymptoms = async () => {
    if (!inputMessage.trim()) {
      toast.error('Please describe your symptoms first');
      return;
    }

    const symptoms = inputMessage.split(',').map(s => s.trim()).filter(s => s);
    
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      content: `Analyzing symptoms: ${symptoms.join(', ')}`,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post('/api/ai-agents/analyze-symptoms', {
        symptoms,
        patientHistory: user?.profile.medicalHistory || []
      });

      const analysis = response.data.data.analysis;
      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        content: response.data.data.recommendation,
        sender: 'ai',
        timestamp: new Date(),
        messageType: 'symptom_analysis',
        metadata: { analysis }
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Symptom analysis failed');
    } finally {
      setIsLoading(false);
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const startVoiceRecording = () => {
    // Voice recording implementation would go here
    setIsRecording(true);
    toast('Voice recording started (feature coming soon)');
    
    // Mock stop after 3 seconds
    setTimeout(() => {
      setIsRecording(false);
      toast.success('Voice recording stopped');
    }, 3000);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.sender === 'user';
    
    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex max-w-xs lg:max-w-md ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          <div className={`flex-shrink-0 ${isUser ? 'ml-2' : 'mr-2'}`}>
            {isUser ? (
              <UserIcon className="h-8 w-8 text-blue-600" />
            ) : (
              <ComputerDesktopIcon className="h-8 w-8 text-green-600" />
            )}
          </div>
          
          {/* Message bubble */}
          <div className={`px-4 py-2 rounded-lg ${
            isUser 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-900'
          }`}>
            <p className="text-sm">{message.content}</p>
            
            {/* Symptom analysis metadata */}
            {message.messageType === 'symptom_analysis' && message.metadata?.analysis && (
              <div className="mt-3 p-3 bg-white rounded border">
                <div className="flex items-center space-x-2 mb-2">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span className="text-xs font-medium text-gray-700">{t('ai.risk_assessment')}</span>
                </div>
                <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  getRiskLevelColor(message.metadata.analysis.riskScore?.level)
                }`}>
                  {message.metadata.analysis.riskScore?.level?.toUpperCase()} RISK
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Score: {message.metadata.analysis.riskScore?.score}/100
                </p>
              </div>
            )}
            
            <p className="text-xs opacity-75 mt-1">
              {message.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{t('ai.title')}</h1>
                <p className="text-sm text-gray-500">
                  {t('ai.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-500">
                {isConnected ? t('ai.connected') : t('ai.disconnected')}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">{t('ai.welcome_title')}</p>
              <p className="text-sm">{t('ai.welcome_subtitle')}</p>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                <span className="text-sm text-gray-600">{t('ai.thinking')}</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('ai.placeholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            
            {/* Voice recording button */}
            <button
              onClick={startVoiceRecording}
              disabled={isRecording || isLoading}
              className={`p-2 rounded-lg transition-colors ${
                isRecording 
                  ? 'bg-red-100 text-red-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isRecording ? (
                <StopIcon className="h-5 w-5" />
              ) : (
                <MicrophoneIcon className="h-5 w-5" />
              )}
            </button>
            
            {/* Send button */}
            <button
              onClick={sendChatMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
          
          {/* Quick actions */}
          {user?.role === 'PATIENT' && (
            <div className="flex items-center space-x-2 mt-3">
              <button
                onClick={analyzeSymptoms}
                disabled={!inputMessage.trim() || isLoading}
                className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 disabled:opacity-50 transition-colors"
              >
                {t('ai.analyze_symptoms')}
              </button>
              <span className="text-xs text-gray-500">
                {t('ai.separate_symptoms_hint')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChat;
