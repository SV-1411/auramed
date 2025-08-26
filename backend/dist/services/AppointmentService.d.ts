export declare class AppointmentService {
    private db;
    private redis;
    createAppointment(appointmentData: any): Promise<any>;
    getAppointmentById(appointmentId: string): Promise<any>;
    findAvailableUrgentDoctor(specializations?: string[]): Promise<any>;
    updateAppointmentStatus(appointmentId: string, status: string): Promise<any>;
    getPatientAppointments(patientId: string, limit?: number): Promise<any[]>;
    getDoctorAppointments(doctorId: string, limit?: number): Promise<any[]>;
    checkDoctorAvailability(doctorId: string, scheduledAt: Date): Promise<boolean>;
}
//# sourceMappingURL=AppointmentService.d.ts.map