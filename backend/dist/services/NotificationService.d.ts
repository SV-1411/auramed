interface Appointment {
    id: string;
    scheduledAt: Date;
    patientId: string;
    doctorId: string;
    type: string;
    duration: number;
}
export declare class NotificationService {
    private prisma;
    private emailTransporter;
    private twilioClient;
    constructor();
    private setupEmailTransporter;
    private setupTwilioClient;
    sendAppointmentConfirmation(patientId: string, appointment: Appointment): Promise<void>;
    sendUrgentAppointmentAlert(patientId: string, appointment: Appointment): Promise<void>;
    notifyDoctorUrgentConsultation(doctorId: string, appointment: Appointment): Promise<void>;
    sendAppointmentReminder(appointmentId: string): Promise<void>;
    sendMedicationReminder(patientId: string, medicationName: string, dosage: string): Promise<void>;
    sendSystemAlert(userId: string, alertType: string, message: string): Promise<void>;
    private sendEmail;
    private sendSMS;
    private sendPushNotification;
    private sendWhatsAppMessage;
    private generateAppointmentConfirmationEmail;
    private formatEmailContent;
    scheduleReminders(): Promise<void>;
}
export {};
//# sourceMappingURL=NotificationService.d.ts.map