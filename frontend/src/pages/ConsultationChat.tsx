import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import {
  PaperAirplaneIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface ConsultationMessage {
  id: string;
  senderId: string;
  content: string;
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'AI_SUMMARY';
  timestamp: string;
  isRead: boolean;
}

interface Consultation {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  patient: any;
  doctor: any;
  appointment: any;
}

const ConsultationChat: React.FC = () => {
  const { user } = useAuth();
  const { consultationId } = useParams<{ consultationId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (consultationId) {
      loadConsultation();
      loadMessages();
      loadSummary();
      
      // Poll for new messages every 3 seconds
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [consultationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConsultation = async () => {
    try {
      // Get consultation details from appointment
      const response = await axios.get(`/api/appointments/${consultationId}`);
      setConsultation(response.data.data.appointment);
    } catch (error) {
      console.error('Error loading consultation:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await axios.get(`/api/consultations/${consultationId}/messages`);
      setMessages(response.data.data.messages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading messages:', error);
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await axios.get(`/api/consultations/${consultationId}/summary`);
      setSummary(response.data.data.summary);
    } catch (error) {
      // Summary might not exist yet
      console.log('No summary available yet');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await axios.post(`/api/consultations/${consultationId}/messages`, {
        content: newMessage,
        messageType: 'TEXT'
      });
      
      setNewMessage('');
      loadMessages(); // Refresh messages
    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const completeConsultation = async () => {
    try {
      const response = await axios.post(`/api/consultations/${consultationId}/complete`);
      setSummary(response.data.data.summary);
      toast.success('Consultation completed successfully');
      loadConsultation(); // Refresh status
    } catch (error) {
      toast.error('Failed to complete consultation');
      console.error(error);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isMyMessage = (senderId: string) => {
    return senderId === user?.id;
  };

  const getMessageTypeIcon = (messageType: string) => {
    switch (messageType) {
      case 'AI_SUMMARY':
        return <DocumentTextIcon className="h-4 w-4 text-blue-500" />;
      case 'SYSTEM':
        return <ExclamationCircleIcon className="h-4 w-4 text-gray-500" />;
      default:
        return <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserIcon className="h-8 w-8 text-gray-400" />
            <div>
              <h1 className="text-lg font-semibold">
                {user?.role === 'PATIENT' 
                  ? `Dr. ${consultation?.doctor?.doctorProfile?.firstName} ${consultation?.doctor?.doctorProfile?.lastName}`
                  : `${consultation?.patient?.patientProfile?.firstName} ${consultation?.patient?.patientProfile?.lastName}`
                }
              </h1>
              <p className="text-sm text-gray-600">
                {consultation?.appointment?.type} Consultation
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              consultation?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              consultation?.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {consultation?.status}
            </span>
            
            {consultation?.status === 'ACTIVE' && user?.role === 'DOCTOR' && (
              <button
                onClick={completeConsultation}
                className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700"
              >
                Complete Consultation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${isMyMessage(message.senderId) ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.messageType === 'SYSTEM' || message.messageType === 'AI_SUMMARY'
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-800 mx-auto'
                  : isMyMessage(message.senderId)
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {(message.messageType === 'SYSTEM' || message.messageType === 'AI_SUMMARY') && 
                  getMessageTypeIcon(message.messageType)
                }
                <div className="flex-1">
                  {message.messageType === 'AI_SUMMARY' && (
                    <div className="text-xs font-medium mb-1">AI Summary Update</div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.messageType === 'SYSTEM' || message.messageType === 'AI_SUMMARY'
                      ? 'text-yellow-600'
                      : isMyMessage(message.senderId)
                      ? 'text-blue-200'
                      : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Summary Panel */}
      {summary && (
        <div className="bg-blue-50 border-t border-blue-200 p-4">
          <div className="flex items-start gap-2">
            <DocumentTextIcon className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 mb-2">Consultation Summary</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>{summary.summary}</p>
                {summary.keyPoints && summary.keyPoints.length > 0 && (
                  <div>
                    <strong>Key Points:</strong>
                    <ul className="list-disc list-inside ml-2">
                      {summary.keyPoints.map((point: string, index: number) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.recommendations && summary.recommendations.length > 0 && (
                  <div>
                    <strong>Recommendations:</strong>
                    <ul className="list-disc list-inside ml-2">
                      {summary.recommendations.map((rec: string, index: number) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      {consultation?.status === 'ACTIVE' && (
        <div className="bg-white border-t border-gray-200 p-4">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <PaperAirplaneIcon className="h-4 w-4" />
              )}
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ConsultationChat;
