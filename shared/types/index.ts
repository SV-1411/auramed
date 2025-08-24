// Shared TypeScript types for AuraMed platform

export interface User {
  id: string;
  email: string;
  phone: string;
  role: 'patient' | 'doctor' | 'admin';
  profile: PatientProfile | DoctorProfile | AdminProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientProfile {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  emergencyContact: string;
  medicalHistory: MedicalRecord[];
  familyMembers: FamilyMember[];
  preferredLanguage: string;
}

export interface DoctorProfile {
  firstName: string;
  lastName: string;
  specialization: string[];
  licenseNumber: string;
  experience: number;
  qualifications: string[];
  availability: AvailabilitySlot[];
  qualityScore: number;
  consultationFee: number;
  languages: string[];
}

export interface AdminProfile {
  firstName: string;
  lastName: string;
  department: string;
  permissions: string[];
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: Date;
  medicalHistory: MedicalRecord[];
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId?: string;
  date: Date;
  symptoms: string[];
  diagnosis: string;
  prescription: Prescription[];
  visitSummary: string;
  riskScore: RiskScore;
  followUpRequired: boolean;
  followUpDate?: Date;
}

export interface Prescription {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface RiskScore {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: string[];
  aiRecommendation: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: Date;
  duration: number; // minutes
  type: 'video' | 'chat' | 'emergency';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  symptoms: string[];
  riskScore: RiskScore;
  consultationNotes?: string;
  prescription?: Prescription[];
  paymentStatus: 'pending' | 'paid' | 'deferred';
  paymentAmount: number;
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isAvailable: boolean;
}

export interface AIAgentMessage {
  id: string;
  agentType: 'patient' | 'doctor' | 'admin';
  fromUserId: string;
  toUserId?: string;
  content: string;
  messageType: 'text' | 'symptom_analysis' | 'appointment_booking' | 'prescription' | 'alert';
  metadata?: Record<string, any>;
  timestamp: Date;
  isProcessed: boolean;
}

export interface SymptomAnalysis {
  symptoms: string[];
  riskScore: RiskScore;
  recommendedAction: 'self_care' | 'schedule_appointment' | 'urgent_consultation' | 'emergency';
  suggestedSpecialization?: string[];
  estimatedWaitTime?: number;
  aiConfidence: number; // 0-1
}

export interface PaymentTransaction {
  id: string;
  appointmentId: string;
  patientId: string;
  amount: number;
  currency: string;
  method: 'card' | 'wallet' | 'emi' | 'deferred';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  gatewayTransactionId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface VideoConsultation {
  id: string;
  appointmentId: string;
  roomId: string;
  accessToken: string;
  status: 'waiting' | 'active' | 'ended';
  startedAt?: Date;
  endedAt?: Date;
  recordingUrl?: string;
  participants: {
    patientId: string;
    doctorId: string;
    patientJoined: boolean;
    doctorJoined: boolean;
  };
}

export interface AIAgentConfig {
  agentType: 'patient' | 'doctor' | 'admin';
  modelProvider: 'openai' | 'claude' | 'custom';
  modelVersion: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  capabilities: string[];
  isActive: boolean;
}

export interface HealthInsight {
  id: string;
  patientId: string;
  type: 'prediction' | 'trend' | 'alert' | 'recommendation';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number; // 0-1
  generatedAt: Date;
  isRead: boolean;
  actionRequired: boolean;
}

export interface DoctorQualityMetrics {
  doctorId: string;
  totalConsultations: number;
  averageRating: number;
  diagnosticAccuracy: number;
  responseTime: number; // average in minutes
  followUpCompliance: number; // percentage
  patientSatisfaction: number;
  qualityScore: number; // calculated composite score
  lastUpdated: Date;
}

export interface SystemAlert {
  id: string;
  type: 'fraud_detection' | 'compliance_violation' | 'system_error' | 'performance_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedEntity: string;
  entityId: string;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
}
