import { PrismaClient } from '@prisma/client';
export declare function initializeDatabase(): Promise<PrismaClient>;
export declare function getDatabase(): PrismaClient;
export declare function disconnectDatabase(): Promise<void>;
//# sourceMappingURL=database.d.ts.map