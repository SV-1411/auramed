import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  PhoneXMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

interface ConsultationRoom {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  roomName: string;
  status: 'waiting' | 'active' | 'ended';
  startTime?: string;
  endTime?: string;
  participants: string[];
}

interface Doctor {
  id: string;
  name: string;
  specialization: string[];
  experience: number;
  rating: number;
  availability: 'online' | 'offline' | 'busy';
}

const VideoConsultation: React.FC = () => {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<ConsultationRoom | null>(null);
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    loadAvailableDoctors();
    setupWebRTC();
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const loadAvailableDoctors = async () => {
    try {
      const response = await axios.get('/api/doctors/available');
      setAvailableDoctors(response.data.data.doctors || []);
    } catch (error) {
      toast.error('Failed to load available doctors');
    }
  };

  const setupWebRTC = () => {
    // Initialize WebRTC peer connection
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    peerConnectionRef.current = new RTCPeerConnection(configuration);

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to remote peer
        sendSignalingMessage('ice-candidate', event.candidate);
      }
    };

    // Handle remote stream
    peerConnectionRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  };

  const startInstantConsultation = async () => {
    if (!user) return;

    try {
      setIsConnecting(true);
      setLoading(true);

      // Find first available doctor
      const availableDoctor = availableDoctors.find(doc => doc.availability === 'online');
      if (!availableDoctor) {
        toast.error('No doctors available at the moment. Please try again later.');
        return;
      }

      // Create consultation room
      const response = await axios.post('/api/consultations/instant', {
        patientId: user.id,
        doctorId: availableDoctor.id,
        type: 'emergency'
      });

      const room = response.data.data.room;
      setActiveRoom(room);

      // Initialize local media
      await initializeMedia();

      // Join the room
      await joinRoom(room.roomName);

      toast.success(`Connecting to Dr. ${availableDoctor.name}...`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to start consultation');
    } finally {
      setIsConnecting(false);
      setLoading(false);
    }
  };

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !isVideoOff,
        audio: !isMuted
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add tracks to peer connection
      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          peerConnectionRef.current!.addTrack(track, stream);
        });
      }
    } catch (error) {
      toast.error('Failed to access camera/microphone');
    }
  };

  const joinRoom = async (roomName: string) => {
    try {
      // Connect to signaling server (WebSocket/Socket.io)
      const response = await axios.post('/api/consultations/join', {
        roomName,
        userId: user?.id
      });

      // Handle WebRTC signaling
      setupSignalingListeners();
    } catch (error) {
      toast.error('Failed to join consultation room');
    }
  };

  const setupSignalingListeners = () => {
    // This would typically use WebSocket/Socket.io for real-time signaling
    // For demo purposes, we'll simulate the connection
    setTimeout(() => {
      toast.success('Connected to consultation room');
    }, 2000);
  };

  const sendSignalingMessage = (type: string, data: any) => {
    // Send signaling messages via WebSocket/Socket.io
    console.log('Sending signaling message:', type, data);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    const stream = localVideoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOff;
      });
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerOn;
    }
  };

  const endConsultation = async () => {
    try {
      if (activeRoom) {
        await axios.put(`/api/consultations/${activeRoom.id}/end`);
        toast.success('Consultation ended successfully');

        // Clean up
        const stream = localVideoRef.current?.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }

        setActiveRoom(null);
        setIsConnecting(false);
      }
    } catch (error) {
      toast.error('Failed to end consultation');
    }
  };

  if (loading && !activeRoom) {
    return <LoadingSpinner text="Setting up consultation..." />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-sapphire-600 via-sapphire-700 to-sapphire-800 dark:from-sapphire-700 dark:via-sapphire-800 dark:to-sapphire-900 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <VideoCameraIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Video Consultation</h1>
              <p className="text-sapphire-100">Connect with healthcare professionals instantly</p>
            </div>
          </div>

          {!activeRoom && (
            <div className="text-right">
              <div className="text-sm text-sapphire-200 mb-1">Available Doctors</div>
              <div className="text-2xl font-bold">{availableDoctors.filter(d => d.availability === 'online').length}</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {!activeRoom ? (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={startInstantConsultation}
              disabled={isConnecting || availableDoctors.filter(d => d.availability === 'online').length === 0}
              className="group relative bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <VideoCameraIcon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg">Emergency Consultation</h3>
                  <p className="text-sm opacity-90">Connect instantly with available doctor</p>
                </div>
              </div>
            </button>

            <button className="group relative bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border hover:shadow-xl transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-sapphire-100 dark:bg-sapphire-900 rounded-xl">
                  <ClockIcon className="h-6 w-6 text-sapphire-700 dark:text-sapphire-300" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary">Scheduled Consultation</h3>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Book appointment in advance</p>
                </div>
              </div>
            </button>

            <button className="group relative bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-light-border dark:border-dark-border hover:shadow-xl transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
                  <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-700 dark:text-green-300" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary">Text Chat</h3>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">Chat with AI assistant first</p>
                </div>
              </div>
            </button>
          </div>

          {/* Available Doctors */}
          <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
            <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">Available Doctors</h3>

            {availableDoctors.length === 0 ? (
              <div className="text-center py-8">
                <UserGroupIcon className="h-12 w-12 text-light-text-secondary dark:text-dark-text-secondary mx-auto mb-4" />
                <p className="text-light-text-secondary dark:text-dark-text-secondary">No doctors available at the moment</p>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">Please try again later or use our AI chat assistant</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableDoctors.map((doctor) => (
                  <div key={doctor.id} className="bg-white/60 dark:bg-dark-surface/60 backdrop-blur-sm rounded-xl p-4 border border-light-border dark:border-dark-border">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-sapphire-500 to-sapphire-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {doctor.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">{doctor.name}</h4>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${
                            doctor.availability === 'online' ? 'bg-green-500' :
                            doctor.availability === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'
                          }`}></span>
                          <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary capitalize">
                            {doctor.availability}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                      <p>{doctor.specialization.join(', ')}</p>
                      <p>{doctor.experience} years experience</p>
                      <div className="flex items-center space-x-1">
                        <span>⭐</span>
                        <span>{doctor.rating}/5.0</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Consultation */
        <div className="space-y-6">
          <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl p-6 border border-light-border dark:border-dark-border">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Consultation in Progress</h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  Connected to Dr. {availableDoctors.find(d => d.id === activeRoom.doctorId)?.name}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Live</span>
              </div>
            </div>

            {/* Video Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Local Video */}
              <div className="relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-64 bg-gray-900 rounded-xl object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
                  You
                </div>
              </div>

              {/* Remote Video */}
              <div className="relative">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-64 bg-gray-900 rounded-xl object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm">
                  Dr. {availableDoctors.find(d => d.id === activeRoom.doctorId)?.name}
                </div>
                {isConnecting && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p className="text-white text-sm">Connecting...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-xl transition-all ${
                  isMuted
                    ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-light-text-primary dark:text-dark-text-primary hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {isMuted ? <MicrophoneIcon className="h-6 w-6" /> : <MicrophoneIcon className="h-6 w-6" />}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-4 rounded-xl transition-all ${
                  isVideoOff
                    ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-light-text-primary dark:text-dark-text-primary hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <VideoCameraIcon className="h-6 w-6" />
              </button>

              <button
                onClick={toggleSpeaker}
                className={`p-4 rounded-xl transition-all ${
                  !isSpeakerOn
                    ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-light-text-primary dark:text-dark-text-primary hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {isSpeakerOn ? <SpeakerWaveIcon className="h-6 w-6" /> : <SpeakerXMarkIcon className="h-6 w-6" />}
              </button>

              <button
                onClick={endConsultation}
                className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all"
              >
                <PhoneXMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Consultation Info */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-light-text-primary dark:text-dark-text-primary">Room:</span>
                  <span className="text-light-text-secondary dark:text-dark-text-secondary ml-2">{activeRoom.roomName}</span>
                </div>
                <div>
                  <span className="font-medium text-light-text-primary dark:text-dark-text-primary">Duration:</span>
                  <span className="text-light-text-secondary dark:text-dark-text-secondary ml-2">--:--</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoConsultation;
