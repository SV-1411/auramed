import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import nodemailer, { Transporter } from 'nodemailer';
import twilio from 'twilio';

interface Appointment {
  id: string;
  scheduledAt: Date;
  patientId: string;
  doctorId: string;
  type: string;
  duration: number;
}

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
}

export class NotificationService {
  private prisma: PrismaClient;
  private emailTransporter: Transporter;
  private twilioClient: any;

  constructor() {
    this.prisma = new PrismaClient();
    this.setupEmailTransporter();
    this.setupTwilioClient();
  }

  private setupEmailTransporter() {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  private setupTwilioClient() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  async sendAppointmentConfirmation(patientId: string, appointment: Appointment): Promise<void> {
    try {
      const patient = await this.prisma.user.findUnique({
        where: { id: patientId },
        include: { patientProfile: true }
      });

      if (!patient) {
        throw new Error('Patient not found');
      }

      const doctor = await this.prisma.user.findUnique({
        where: { id: appointment.doctorId },
        include: { doctorProfile: true }
      });

      const emailContent = this.generateAppointmentConfirmationEmail(patient, doctor, appointment);
      
      // Send email notification
      if (patient.email) {
        await this.sendEmail(
          patient.email,
          'Appointment Confirmation - AuraMed',
          emailContent
        );
      }

      // Send SMS notification
      if (patient.patientProfile?.phoneNumber) {
        const smsContent = `AuraMed: Your appointment is confirmed for ${appointment.scheduledAt.toLocaleString()} with Dr. ${doctor?.doctorProfile?.firstName} ${doctor?.doctorProfile?.lastName}. Appointment ID: ${appointment.id}`;
        await this.sendSMS(patient.patientProfile.phoneNumber, smsContent);
      }

      logger.info(`Appointment confirmation sent to patient: ${patientId}`);

    } catch (error) {
      logger.error('Failed to send appointment confirmation:', error);
    }
  }

  async sendUrgentAppointmentAlert(patientId: string, appointment: Appointment): Promise<void> {
    try {
      const patient = await this.prisma.user.findUnique({
        where: { id: patientId },
        include: { patientProfile: true }
      });

      if (!patient) return;

      const urgentMessage = `🚨 URGENT: Emergency consultation scheduled for ${appointment.scheduledAt.toLocaleString()}. Please join the video call immediately. Appointment ID: ${appointment.id}`;

      // Send immediate notifications via all channels
      if (patient.email) {
        await this.sendEmail(
          patient.email,
          '🚨 URGENT: Emergency Consultation Scheduled',
          urgentMessage
        );
      }

      if (patient.patientProfile?.phoneNumber) {
        await this.sendSMS(patient.patientProfile.phoneNumber, urgentMessage);
      }

      // Send push notification if available
      await this.sendPushNotification(patientId, 'Emergency Consultation', urgentMessage);

    } catch (error) {
      logger.error('Failed to send urgent appointment alert:', error);
    }
  }

  async notifyDoctorUrgentConsultation(doctorId: string, appointment: Appointment): Promise<void> {
    try {
      const doctor = await this.prisma.user.findUnique({
        where: { id: doctorId },
        include: { doctorProfile: true }
      });

      if (!doctor) return;

      const patient = await this.prisma.user.findUnique({
        where: { id: appointment.patientId },
        include: { patientProfile: true }
      });

      const urgentMessage = `🚨 URGENT CONSULTATION: Patient ${patient?.patientProfile?.firstName} ${patient?.patientProfile?.lastName} needs immediate attention. Appointment scheduled for ${appointment.scheduledAt.toLocaleString()}. ID: ${appointment.id}`;

      if (doctor.email) {
        await this.sendEmail(
          doctor.email,
          '🚨 URGENT: Patient Consultation Required',
          urgentMessage
        );
      }

      if (doctor.doctorProfile?.phoneNumber) {
        await this.sendSMS(doctor.doctorProfile.phoneNumber, urgentMessage);
      }

      await this.sendPushNotification(doctorId, 'Urgent Consultation', urgentMessage);

    } catch (error) {
      logger.error('Failed to notify doctor of urgent consultation:', error);
    }
  }

  async sendAppointmentReminder(appointmentId: string): Promise<void> {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: { include: { patientProfile: true } },
          doctor: { include: { doctorProfile: true } }
        }
      });

      if (!appointment) return;

      const reminderTime = new Date(appointment.scheduledAt.getTime() - 30 * 60 * 1000); // 30 minutes before
      const now = new Date();

      if (now >= reminderTime) {
        const message = `Reminder: Your appointment with Dr. ${appointment.doctor.doctorProfile?.firstName} ${appointment.doctor.doctorProfile?.lastName} is in 30 minutes (${appointment.scheduledAt.toLocaleString()}). Please be ready to join the video call.`;

        if (appointment.patient.email) {
          await this.sendEmail(
            appointment.patient.email,
            'Appointment Reminder - AuraMed',
            message
          );
        }

        if (appointment.patient.patientProfile?.phoneNumber) {
          await this.sendSMS(appointment.patient.patientProfile.phoneNumber, message);
        }
      }

    } catch (error) {
      logger.error('Failed to send appointment reminder:', error);
    }
  }

  async sendMedicationReminder(patientId: string, medicationName: string, dosage: string): Promise<void> {
    try {
      const patient = await this.prisma.user.findUnique({
        where: { id: patientId },
        include: { patientProfile: true }
      });

      if (!patient) return;

      const message = `💊 Medication Reminder: Time to take your ${medicationName} (${dosage}). Stay consistent with your treatment plan.`;

      if (patient.patientProfile?.phoneNumber) {
        await this.sendSMS(patient.patientProfile.phoneNumber, message);
      }

      await this.sendPushNotification(patientId, 'Medication Reminder', message);

    } catch (error) {
      logger.error('Failed to send medication reminder:', error);
    }
  }

  async sendSystemAlert(userId: string, alertType: string, message: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) return;

      // Create system alert record
      await this.prisma.systemAlert.create({
        data: {
          type: alertType,
          severity: 'medium',
          title: `System Alert: ${alertType}`,
          description: message,
          userId: userId,
          isResolved: false
        }
      });

      // Send notification
      if (user.email) {
        await this.sendEmail(
          user.email,
          `AuraMed System Alert: ${alertType}`,
          message
        );
      }

      await this.sendPushNotification(userId, 'System Alert', message);

    } catch (error) {
      logger.error('Failed to send system alert:', error);
    }
  }

  private async sendEmail(to: string, subject: string, content: string): Promise<void> {
    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject,
        html: this.formatEmailContent(content)
      });

      logger.info(`Email sent to: ${to}`);

    } catch (error) {
      logger.error('Failed to send email:', error);
    }
  }

  private async sendSMS(to: string, message: string): Promise<void> {
    try {
      if (!this.twilioClient) {
        logger.warn('Twilio not configured, skipping SMS');
        return;
      }

      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      logger.info(`SMS sent to: ${to}`);

    } catch (error) {
      logger.error('Failed to send SMS:', error);
    }
  }

  private async sendPushNotification(userId: string, title: string, message: string): Promise<void> {
    try {
      // Push notification implementation would go here
      // For now, just log the notification
      logger.info(`Push notification for user ${userId}: ${title} - ${message}`);

    } catch (error) {
      logger.error('Failed to send push notification:', error);
    }
  }

  private async sendWhatsAppMessage(to: string, message: string): Promise<void> {
    try {
      // WhatsApp Business API implementation would go here
      logger.info(`WhatsApp message to ${to}: ${message}`);

    } catch (error) {
      logger.error('Failed to send WhatsApp message:', error);
    }
  }

  private generateAppointmentConfirmationEmail(patient: any, doctor: any, appointment: Appointment): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Confirmation</h2>
        
        <p>Dear ${patient.patientProfile?.firstName || patient.firstName},</p>
        
        <p>Your appointment has been successfully scheduled with AuraMed.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Appointment Details</h3>
          <p><strong>Appointment ID:</strong> ${appointment.id}</p>
          <p><strong>Date & Time:</strong> ${appointment.scheduledAt.toLocaleString()}</p>
          <p><strong>Doctor:</strong> Dr. ${doctor?.doctorProfile?.firstName} ${doctor?.doctorProfile?.lastName}</p>
          <p><strong>Duration:</strong> ${appointment.duration} minutes</p>
          <p><strong>Type:</strong> ${appointment.type}</p>
        </div>
        
        <p><strong>Important Notes:</strong></p>
        <ul>
          <li>Please join the video call 5 minutes before your scheduled time</li>
          <li>Ensure you have a stable internet connection</li>
          <li>Have your medical history and current medications ready</li>
          <li>You will receive a reminder 30 minutes before your appointment</li>
        </ul>
        
        <p>If you need to reschedule or cancel, please contact us at least 2 hours before your appointment.</p>
        
        <p>Best regards,<br>AuraMed Team</p>
      </div>
    `;
  }

  private formatEmailContent(content: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb;">AuraMed</h1>
          <p style="color: #6b7280;">AI-Powered Healthcare Platform</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${content.replace(/\n/g, '<br>')}
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px;">
          <p>This is an automated message from AuraMed. Please do not reply to this email.</p>
        </div>
      </div>
    `;
  }

  async scheduleReminders(): Promise<void> {
    try {
      // Get appointments in the next hour that need reminders
      const upcomingAppointments = await this.prisma.appointment.findMany({
        where: {
          scheduledAt: {
            gte: new Date(),
            lte: new Date(Date.now() + 60 * 60 * 1000) // Next hour
          },
          status: 'scheduled'
        }
      });

      for (const appointment of upcomingAppointments) {
        await this.sendAppointmentReminder(appointment.id);
      }

    } catch (error) {
      logger.error('Failed to schedule reminders:', error);
    }
  }
}
