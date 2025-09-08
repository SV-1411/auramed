export {}

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      userId: string;
      role: string;
    };
  }
}
