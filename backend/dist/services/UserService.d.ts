import { User, UserRole } from '@prisma/client';
export declare class UserService {
    private prisma;
    constructor();
    getUserById(userId: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getAllDoctors(): Promise<User[]>;
    updateDoctorQualityScore(doctorId: string, qualityScore: number): Promise<void>;
    createUser(userData: {
        email: string;
        password: string;
        role: UserRole;
        phone: string;
    }): Promise<User>;
    updateUser(userId: string, updateData: Partial<User>): Promise<User>;
    deleteUser(userId: string): Promise<void>;
    verifyUserCredentials(email: string, password: string): Promise<User | null>;
    getUsersByRole(role: UserRole): Promise<User[]>;
}
//# sourceMappingURL=UserService.d.ts.map