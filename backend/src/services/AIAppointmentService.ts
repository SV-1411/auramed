import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { OpenAIService } from './OpenAIService';
import { NotificationService } from './NotificationService';
import { MessageType } from '@prisma/client';

export interface SymptomAnalysisResult {
  symptoms: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  recommendedSpecializations: string[];
  aiExplanation: string;
  confidence: number;
}

export interface DoctorRecommendation {
  doctorId: string;
  doctor: any;
  matchScore: number;
  availableSlots: Date[];
  distance?: number;
  specializations: string[];
  rating: number;
  consultationFee: number;
  reasonForRecommendation: string;
}

export interface AppointmentRequest {
  patientId: string;
  symptoms: string[];
  patientLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  preferredTime?: Date;
  urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  maxDistance?: number; // in km
  maxFee?: number;
  preferredFee?: number;
}

export class AIAppointmentService {
  private get db() { return getDatabase(); }
  private openAI: OpenAIService;
  private notificationService: NotificationService;

  constructor() {
    this.openAI = new OpenAIService();
    this.notificationService = new NotificationService();
  }

  /**
   * AI-powered symptom analysis and doctor recommendation
   */
  async analyzeAndRecommendDoctors(request: AppointmentRequest): Promise<{
    analysis: SymptomAnalysisResult;
    recommendations: DoctorRecommendation[];
  }> {
    try {
      // Step 1: AI Symptom Analysis
      const analysis = await this.analyzeSymptoms(request.symptoms);
      
      // Step 2: Find matching doctors based on analysis
      const recommendations = await this.findMatchingDoctors(analysis, request);
      
      // Step 3: Auto-book for critical cases
      if (analysis.severity === 'CRITICAL') {
        await this.autoBookCriticalAppointment(request, analysis, recommendations[0]);
      }

      return { analysis, recommendations };
    } catch (error) {
      logger.error('Error in AI appointment analysis:', error);
      throw error;
    }
  }

  /**
   * AI-powered symptom analysis using OpenAI
   */
  private async analyzeSymptoms(symptoms: string[]): Promise<SymptomAnalysisResult> {
    const prompt = `
    As a medical AI triage system, analyze these symptoms and provide a structured assessment:
    
    Symptoms: ${symptoms.join(', ')}
    
    Provide your analysis in the following JSON format:
    {
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "riskScore": 0-100,
      "urgency": "ROUTINE|URGENT|EMERGENCY",
      "recommendedSpecializations": ["specialization1", "specialization2"],
      "aiExplanation": "detailed explanation of the assessment",
      "confidence": 0.0-1.0,
      "redFlags": ["any concerning symptoms"],
      "timeframe": "how soon patient should be seen"
    }
    
    Guidelines:
    - CRITICAL: Life-threatening, needs immediate attention
    - HIGH: Serious condition, needs urgent care within hours
    - MEDIUM: Concerning symptoms, needs care within days
    - LOW: Minor issues, routine care sufficient
    `;

    try {
      const response = await this.openAI.generateResponse(
        'You are a medical triage AI assistant. Analyze symptoms and provide structured medical assessments.',
        prompt,
        'system'
      );

      const parsed = JSON.parse(response);
      
      return {
        symptoms,
        severity: parsed.severity,
        riskScore: parsed.riskScore,
        urgency: parsed.urgency,
        recommendedSpecializations: parsed.recommendedSpecializations || [],
        aiExplanation: parsed.aiExplanation,
        confidence: parsed.confidence
      };
    } catch (error) {
      logger.error('Error in symptom analysis:', error);
      // Fallback analysis
      return {
        symptoms,
        severity: 'MEDIUM',
        riskScore: 50,
        urgency: 'ROUTINE',
        recommendedSpecializations: ['General Medicine'],
        aiExplanation: 'Unable to perform detailed analysis. Please consult with a healthcare provider.',
        confidence: 0.5
      };
    }
  }

  /**
   * Find and rank doctors based on AI analysis and patient preferences
   */
  private async findMatchingDoctors(
    analysis: SymptomAnalysisResult, 
    request: AppointmentRequest
  ): Promise<DoctorRecommendation[]> {
    try {
      // Build query based on specializations and availability
      const whereClause: any = {
        role: 'DOCTOR',
        isActive: true,
        doctorProfile: {
          isVerified: true,
          specialization: {
            hasSome: analysis.recommendedSpecializations
          }
        }
      };

      // Get doctors with profiles and availability
      const doctors = await this.db.user.findMany({
        where: whereClause,
        include: {
          doctorProfile: {
            include: {
              availabilitySlots: true,
              qualityMetrics: true,
              reviews: {
                take: 5,
                orderBy: { createdAt: 'desc' }
              }
            }
          }
        }
      });

      // Score and rank doctors
      const recommendations: DoctorRecommendation[] = [];

      const patientHistory = await this.getPatientHistory(request.patientId).catch(() => null);

      for (const doctor of doctors) {
        const d: any = doctor as any; // TS safety for optional profile fields
        const consultationFee = d.doctorProfile?.consultationFee || 500;
        if (typeof request.maxFee === 'number' && consultationFee > request.maxFee) {
          continue;
        }

        const distance = request.patientLocation
          ? await this.calculateDistance(request.patientLocation, (d.doctorProfile && (d.doctorProfile as any).location) || undefined)
          : undefined;

        // Enforce maxDistance filter if provided and distance is known
        if (request.maxDistance && distance !== undefined && distance > request.maxDistance) {
          continue;
        }

        const availableSlots = await this.getAvailableSlotsForDoctor(d, analysis.urgency);
        const matchScore = await this.calculateDoctorMatchScore(d, analysis, request, {
          distance,
          consultationFee,
          availableSlots,
          patientHistory
        });
        
        if (availableSlots.length > 0 || analysis.severity === 'CRITICAL') {
          recommendations.push({
            doctorId: d.id,
            doctor: {
              id: d.id,
              profile: d.doctorProfile,
              name: `${d.doctorProfile?.firstName || ''} ${d.doctorProfile?.lastName || ''}`.trim(),
              specializations: d.doctorProfile?.specialization || [],
              experience: d.doctorProfile?.experience || 0,
              rating: d.doctorProfile?.qualityScore || 0,
              totalReviews: (d.doctorProfile?.reviews && d.doctorProfile?.reviews.length) || 0
            },
            matchScore,
            availableSlots,
            distance,
            specializations: d.doctorProfile?.specialization || [],
            rating: d.doctorProfile?.qualityScore || 0,
            consultationFee,
            reasonForRecommendation: this.generateRecommendationReason(matchScore, analysis, d, {
              distance,
              consultationFee,
              availableSlots,
              patientHistory
            })
          });
        }
      }

      // Sort by match score, distance (asc), and rating
      return recommendations.sort((a, b) => {
        // Prioritize by severity first
        if (analysis.severity === 'CRITICAL') {
          return b.matchScore - a.matchScore;
        }
        
        // If both have distances, sort by closer first when matchScore similar
        const scoreDiff = b.matchScore - a.matchScore;
        if (scoreDiff !== 0) return scoreDiff;
        const aDist = a.distance ?? Number.POSITIVE_INFINITY;
        const bDist = b.distance ?? Number.POSITIVE_INFINITY;
        if (aDist !== bDist) return aDist - bDist;
        // Then by rating
        return (b.rating || 0) - (a.rating || 0);
      }).slice(0, 5); // Top 5 recommendations

    } catch (error) {
      logger.error('Error finding matching doctors:', error);
      return [];
    }
  }

  /**
   * Calculate doctor match score based on AI analysis
   */
  private async calculateDoctorMatchScore(
    doctor: any, 
    analysis: SymptomAnalysisResult, 
    request: AppointmentRequest,
    ctx?: {
      distance?: number;
      consultationFee: number;
      availableSlots: Date[];
      patientHistory: any;
    }
  ): Promise<number> {
    const context = ctx || {
      distance: undefined,
      consultationFee: doctor.doctorProfile?.consultationFee || 500,
      availableSlots: [],
      patientHistory: null
    };

    let score = 0;

    // Specialization match (35)
    const doctorSpecs = doctor.doctorProfile?.specialization || [];
    const recSpecs = analysis.recommendedSpecializations || [];
    const matchingSpecs = recSpecs.length
      ? recSpecs.filter((spec) => doctorSpecs.some((dSpec: string) => dSpec.toLowerCase().includes(String(spec).toLowerCase())))
      : [];
    const specRatio = recSpecs.length ? matchingSpecs.length / recSpecs.length : 0.5;
    score += specRatio * 35;

    // Experience + rating (20)
    const experience = doctor.doctorProfile?.experience || 0;
    const rating = doctor.doctorProfile?.qualityScore || 0;
    score += Math.min(experience / 12, 1) * 8;
    score += Math.min(Math.max(rating, 0) / 5, 1) * 12;

    // Availability (20)
    const now = Date.now();
    const soonest = context.availableSlots[0];
    if (analysis.urgency === 'EMERGENCY') {
      const hasImmediateAvailability = await this.checkImmediateAvailability(doctor.id);
      score += hasImmediateAvailability ? 20 : 0;
    } else if (soonest) {
      const minutes = Math.max(0, Math.round((soonest.getTime() - now) / 60000));
      if (minutes <= 60) score += 20;
      else if (minutes <= 240) score += 14;
      else if (minutes <= 1440) score += 8;
      else score += 3;
    }

    // Distance (15)
    if (typeof context.distance === 'number' && Number.isFinite(context.distance)) {
      const maxD = request.maxDistance ?? 50;
      const d = Math.min(Math.max(context.distance, 0), 999);
      const normalized = Math.max(0, Math.min(1, 1 - d / Math.max(1, maxD)));
      score += normalized * 15;
    } else {
      score += 4;
    }

    // Fee preference (10)
    if (typeof request.preferredFee === 'number' && request.preferredFee > 0) {
      const diff = Math.abs(context.consultationFee - request.preferredFee);
      const normalized = Math.max(0, 1 - diff / Math.max(1, request.preferredFee));
      score += normalized * 10;
    } else if (typeof request.maxFee === 'number' && request.maxFee > 0) {
      const normalized = Math.max(0, 1 - context.consultationFee / request.maxFee);
      score += normalized * 10;
    } else {
      score += 5;
    }

    // Patient ↔ doctor history (up to 10)
    const affinity = this.calculatePatientDoctorAffinity(context.patientHistory, doctor.id);
    score += affinity;

    // Urgency match (bonus up to 5)
    if (analysis.urgency === 'EMERGENCY') {
      const hasImmediateAvailability = await this.checkImmediateAvailability(doctor.id);
      if (hasImmediateAvailability) score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Auto-book appointment for critical cases
   */
  private async autoBookCriticalAppointment(
    request: AppointmentRequest,
    analysis: SymptomAnalysisResult,
    topDoctor: DoctorRecommendation
  ): Promise<void> {
    if (!topDoctor) {
      logger.error('No available doctor for critical appointment');
      return;
    }

    try {
      // Create emergency appointment
      const appointment = await this.db.appointment.create({
        data: {
          patientId: request.patientId,
          doctorId: topDoctor.doctorId,
          scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
          duration: 30,
          type: 'EMERGENCY',
          symptoms: analysis.symptoms,
          riskLevel: analysis.severity,
          riskScore: analysis.riskScore,
          status: 'SCHEDULED',
          paymentAmount: topDoctor.consultationFee,
          paymentStatus: 'DEFERRED', // Allow deferred payment for emergencies
          consultationNotes: `EMERGENCY AUTO-BOOKING: ${analysis.aiExplanation}`
        }
      });

      // Create conversation thread
      await this.createConsultationConversation(appointment.id, request.patientId, topDoctor.doctorId);

      // Send urgent notifications
      await this.notificationService.sendUrgentAppointmentAlert(request.patientId, appointment);
      await this.notificationService.notifyDoctorUrgentConsultation(topDoctor.doctorId, appointment);

      logger.info(`Critical appointment auto-booked: ${appointment.id}`);
    } catch (error) {
      logger.error('Error auto-booking critical appointment:', error);
    }
  }

  /**
   * Create consultation conversation thread
   */
  private async createConsultationConversation(
    appointmentId: string,
    patientId: string,
    doctorId: string
  ): Promise<void> {
    try {
      await this.db.consultation.create({
        data: {
          appointmentId,
          patientId,
          doctorId,
          status: 'ACTIVE',
          messages: {
            create: [{
              senderId: 'system',
              content: 'Consultation conversation started. AI summaries will be generated for both parties.',
              messageType: MessageType.SYSTEM,
              timestamp: new Date()
            }]
          }
        }
      });
    } catch (error) {
      logger.error('Error creating consultation conversation:', error);
    }
  }

  /**
   * Book appointment with selected doctor
   */
  async bookAppointmentWithDoctor(
    patientId: string,
    doctorId: string,
    scheduledAt: Date,
    symptoms: string[],
    analysis: SymptomAnalysisResult
  ): Promise<any> {
    try {
      // Check doctor availability
      const isAvailable = await this.checkDoctorAvailability(doctorId, scheduledAt);
      if (!isAvailable) {
        throw new Error('Doctor not available at selected time');
      }

      // Get doctor details
      const doctor = await this.db.user.findUnique({
        where: { id: doctorId },
        include: { doctorProfile: true }
      });

      if (!doctor) {
        throw new Error('Doctor not found');
      }

      // Create appointment
      const appointment = await this.db.appointment.create({
        data: {
          patientId,
          doctorId,
          scheduledAt,
          duration: 30,
          type: analysis.urgency === 'EMERGENCY' ? 'EMERGENCY' : 'VIDEO',
          symptoms,
          riskLevel: analysis.severity,
          riskScore: analysis.riskScore,
          status: 'SCHEDULED',
          paymentAmount: doctor.doctorProfile?.consultationFee || 500,
          paymentStatus: 'PENDING'
        },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });

      // Create conversation thread
      await this.createConsultationConversation(appointment.id, patientId, doctorId);

      // Generate AI profiles for both parties
      await this.generateAIProfiles(appointment.id, patientId, doctorId);

      // Send notifications
      await this.notificationService.sendAppointmentConfirmation(patientId, appointment);
      await this.notificationService.notifyDoctorNewAppointment(doctorId, appointment);

      return appointment;
    } catch (error) {
      logger.error('Error booking appointment:', error);
      throw error;
    }
  }

  /**
   * Generate AI profiles for patient and doctor
   */
  private async generateAIProfiles(appointmentId: string, patientId: string, doctorId: string): Promise<void> {
    try {
      // Get patient history
      const patientHistory = await this.getPatientHistory(patientId);
      const doctorHistory = await this.getDoctorHistory(doctorId);

      // Generate AI summaries
      const patientSummary = await this.generatePatientSummary(patientHistory);
      const doctorSummary = await this.generateDoctorSummary(doctorHistory);

      // Store AI profiles
      await (this.db as any).aIProfile.createMany({
        data: [
          {
            appointmentId,
            userId: patientId,
            profileType: 'PATIENT',
            aiSummary: patientSummary,
            visibleTo: doctorId,
            generatedAt: new Date()
          },
          {
            appointmentId,
            userId: doctorId,
            profileType: 'DOCTOR',
            aiSummary: doctorSummary,
            visibleTo: patientId,
            generatedAt: new Date()
          }
        ]
      });
    } catch (error) {
      logger.error('Error generating AI profiles:', error);
    }
  }

  // Helper methods
  private parseTimeToMinutes(time: string): number {
    const [hh, mm] = String(time || '').split(':').map((x) => parseInt(x, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
    return Math.max(0, Math.min(23, hh)) * 60 + Math.max(0, Math.min(59, mm));
  }

  private addMinutesToDate(base: Date, minutes: number) {
    return new Date(base.getTime() + minutes * 60 * 1000);
  }

  private startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private buildCandidateSlotsFromAvailability(availabilitySlots: any[], days: number, slotMinutes: number): Date[] {
    const now = new Date();
    const candidates: Date[] = [];
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const date = this.startOfDay(this.addMinutesToDate(now, dayOffset * 24 * 60));
      const dow = date.getDay();
      const daySlots = (availabilitySlots || []).filter((s: any) => s?.isAvailable && s?.dayOfWeek === dow);
      for (const s of daySlots) {
        const startMin = this.parseTimeToMinutes(s.startTime);
        const endMin = this.parseTimeToMinutes(s.endTime);
        for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
          const candidate = this.addMinutesToDate(date, m);
          if (candidate.getTime() >= now.getTime() + 2 * 60 * 1000) {
            candidates.push(candidate);
          }
        }
      }
    }
    return candidates.sort((a, b) => a.getTime() - b.getTime());
  }

  private async getAvailableSlotsForDoctor(doctor: any, urgency: string): Promise<Date[]> {
    const now = new Date();
    if (urgency === 'EMERGENCY') {
      const hasImmediateAvailability = await this.checkImmediateAvailability(doctor.id);
      return hasImmediateAvailability ? [new Date(now.getTime() + 5 * 60 * 1000)] : [];
    }

    const availabilitySlots = doctor?.doctorProfile?.availabilitySlots || [];
    const candidates = this.buildCandidateSlotsFromAvailability(availabilitySlots, 7, 30);
    if (!candidates.length) return [];

    const endWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const existing = await this.db.appointment.findMany({
      where: {
        doctorId: doctor.id,
        scheduledAt: { gte: now, lte: endWindow },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
      },
      select: { scheduledAt: true }
    });
    const taken = new Set(existing.map((a: any) => new Date(a.scheduledAt).getTime()));

    const free = candidates.filter((c) => !taken.has(c.getTime()));

    // Prefer the earliest few slots
    return free.slice(0, 8);
  }

  private async checkImmediateAvailability(doctorId: string): Promise<boolean> {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    
    const conflictingAppointment = await this.db.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt: {
          gte: now,
          lte: thirtyMinutesFromNow
        },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
      }
    });
    
    return !conflictingAppointment;
  }

  private calculatePatientDoctorAffinity(patientHistory: any, doctorId: string): number {
    if (!patientHistory?.appointments || !Array.isArray(patientHistory.appointments)) return 0;
    const appts = patientHistory.appointments.filter((a: any) => a?.doctorId === doctorId);
    if (!appts.length) return 0;

    const completed = appts.filter((a: any) => a?.status === 'COMPLETED').length;
    const recentCount = appts.length;

    let score = 0;
    score += Math.min(6, recentCount * 2);
    score += Math.min(4, completed);
    return Math.min(10, score);
  }

  private async checkDoctorAvailability(doctorId: string, scheduledAt: Date): Promise<boolean> {
    const conflictingAppointment = await this.db.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
      }
    });
    
    return !conflictingAppointment;
  }

  private async calculateDistance(
    patientLocation: { latitude: number; longitude: number },
    doctorLocation: any
  ): Promise<number> {
    // Simplified distance calculation (in real app, use proper geolocation service)
    if (!doctorLocation?.latitude || !doctorLocation?.longitude) {
      return 999; // Unknown distance
    }
    
    const R = 6371; // Earth's radius in km
    const dLat = (doctorLocation.latitude - patientLocation.latitude) * Math.PI / 180;
    const dLon = (doctorLocation.longitude - patientLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(patientLocation.latitude * Math.PI / 180) * Math.cos(doctorLocation.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get appointment by ID
   */
  async getAppointmentById(appointmentId: string): Promise<any> {
    try {
      return await this.db.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });
    } catch (error) {
      logger.error('Error fetching appointment:', error);
      throw error;
    }
  }

  /**
   * Get AI profiles for appointment
   */
  async getAIProfiles(appointmentId: string, userId: string): Promise<any[]> {
    try {
      return await (this.db as any).aIProfile.findMany({
        where: {
          appointmentId,
          visibleTo: userId
        }
      });
    } catch (error) {
      logger.error('Error fetching AI profiles:', error);
      throw error;
    }
  }

  /**
   * Get doctor profiles with filters
   */
  async getDoctorProfiles(filters: any): Promise<any[]> {
    try {
      let whereClause: any = {
        role: 'DOCTOR',
        isActive: true,
        doctorProfile: {
          isVerified: true
        }
      };

      if (filters.specialization) {
        whereClause.doctorProfile.specialization = {
          has: filters.specialization
        };
      }

      const doctors = await this.db.user.findMany({
        where: whereClause,
        include: {
          doctorProfile: {
            include: {
              reviews: { take: 5, orderBy: { createdAt: 'desc' } },
              qualityMetrics: true
            }
          }
        },
        orderBy: {
          doctorProfile: {
            qualityScore: 'desc'
          }
        }
      });

      return doctors.map((doc: any) => ({
        id: doc.id,
        profile: doc.doctorProfile,
        name: `${doc.doctorProfile?.firstName || ''} ${doc.doctorProfile?.lastName || ''}`.trim(),
        rating: doc.doctorProfile?.qualityScore || 0,
        reviewCount: (doc.doctorProfile?.reviews && doc.doctorProfile?.reviews.length) || 0
      }));
    } catch (error) {
      logger.error('Error fetching doctor profiles:', error);
      throw error;
    }
  }

  /**
   * Get emergency queue status
   */
  async getEmergencyQueueStatus(): Promise<any> {
    try {
      const criticalAppointments = await this.db.appointment.count({
        where: {
          riskLevel: 'CRITICAL',
          status: 'SCHEDULED',
          scheduledAt: {
            gte: new Date()
          }
        }
      });

      return {
        criticalCount: criticalAppointments,
        totalInQueue: criticalAppointments,
        averageWaitTime: criticalAppointments * 5 // 5 minutes per critical case
      };
    } catch (error) {
      logger.error('Error fetching emergency queue status:', error);
      throw error;
    }
  }

  /**
   * Accept emergency appointment
   */
  async acceptEmergencyAppointment(appointmentId: string, doctorId: string): Promise<any> {
    try {
      const appointment = await this.db.appointment.findFirst({
        where: {
          id: appointmentId,
          riskLevel: 'CRITICAL',
          status: 'SCHEDULED'
        }
      });

      if (!appointment) {
        throw new Error('Emergency appointment not found or already accepted');
      }

      // Update appointment with accepting doctor
      const updatedAppointment = await this.db.appointment.update({
        where: { id: appointmentId },
        data: {
          doctorId,
          status: 'IN_PROGRESS'
        },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });

      // Create consultation
      await this.createConsultationConversation(appointmentId, appointment.patientId, doctorId);

      // Notify patient
      await this.notificationService.sendUrgentAppointmentAlert(appointment.patientId, updatedAppointment);

      return updatedAppointment;
    } catch (error) {
      logger.error('Error accepting emergency appointment:', error);
      throw error;
    }
  }

  private generateRecommendationReason(
    score: number,
    analysis: SymptomAnalysisResult,
    doctor: any,
    ctx?: { distance?: number; consultationFee: number; availableSlots: Date[]; patientHistory: any }
  ): string {
    const reasons: string[] = [];

    if (score >= 85) reasons.push('Excellent match for your symptoms');
    else if (score >= 70) reasons.push('Strong match for your symptoms');

    if (doctor.doctorProfile?.qualityScore >= 4.5) reasons.push('Highly rated by patients');
    if (doctor.doctorProfile?.experience >= 10) reasons.push('Extensive experience');

    const matchingSpecs = (analysis.recommendedSpecializations || []).filter((spec) =>
      doctor.doctorProfile?.specialization?.some((dSpec: string) => dSpec.toLowerCase().includes(String(spec).toLowerCase()))
    );
    if (matchingSpecs.length > 0) {
      reasons.push(`Specializes in ${matchingSpecs.slice(0, 2).join(', ')}`);
    }

    if (ctx?.availableSlots?.length) {
      const mins = Math.max(0, Math.round((ctx.availableSlots[0].getTime() - Date.now()) / 60000));
      if (mins <= 60) reasons.push('Available soon');
      else reasons.push('Available in the next few days');
    }

    if (typeof ctx?.distance === 'number' && Number.isFinite(ctx.distance) && ctx.distance < 999) {
      reasons.push(`${ctx.distance.toFixed(1)} km away`);
    }

    if (typeof ctx?.consultationFee === 'number') {
      reasons.push(`Fee ₹${Math.round(ctx.consultationFee)}`);
    }

    const affinity = this.calculatePatientDoctorAffinity(ctx?.patientHistory, doctor.id);
    if (affinity >= 6) reasons.push('You have consulted this doctor before');

    return reasons.join(' • ') || 'Good general match for your needs';
  }

  private async getPatientHistory(patientId: string): Promise<any> {
    return await this.db.user.findUnique({
      where: { id: patientId },
      include: {
        patientProfile: true,
        appointments: {
          take: 10,
          orderBy: { scheduledAt: 'desc' },
          include: { doctor: { include: { doctorProfile: true } } }
        }
      }
    });
  }

  private async getDoctorHistory(doctorId: string): Promise<any> {
    return await this.db.user.findUnique({
      where: { id: doctorId },
      include: {
        doctorProfile: {
          include: {
            qualityMetrics: true,
            reviews: { take: 10, orderBy: { createdAt: 'desc' } }
          }
        }
      }
    });
  }

  private async generatePatientSummary(patientHistory: any): Promise<string> {
    const prompt = `Generate a professional medical summary for this patient that a doctor can review before consultation:

Patient Profile: ${JSON.stringify(patientHistory.patientProfile)}
Recent Appointments: ${JSON.stringify(patientHistory.patientAppointments)}

Create a concise summary including:
- Key medical history
- Recent consultations
- Current medications/allergies
- Risk factors
- Relevant notes for upcoming consultation

Keep it professional and HIPAA-compliant.`;

    try {
      return await this.openAI.generateResponse(
        'You are a medical AI creating patient summaries for doctors.',
        prompt,
        'system'
      );
    } catch (error) {
      return 'Patient summary generation failed. Please review patient profile manually.';
    }
  }

  private async generateDoctorSummary(doctorHistory: any): Promise<string> {
    const prompt = `Generate a professional summary for this doctor that a patient can review:

Doctor Profile: ${JSON.stringify(doctorHistory.doctorProfile)}
Quality Metrics: ${JSON.stringify(doctorHistory.doctorProfile?.qualityMetrics)}
Recent Reviews: ${JSON.stringify(doctorHistory.doctorProfile?.reviews)}

Create a summary including:
- Specializations and expertise
- Experience and qualifications
- Patient satisfaction ratings
- Communication style
- Areas of excellence

Keep it professional and patient-friendly.`;

    try {
      return await this.openAI.generateResponse(
        'You are creating doctor summaries for patients.',
        prompt,
        'system'
      );
    } catch (error) {
      return 'Doctor summary generation failed. Please review doctor profile manually.';
    }
  }
}
