declare namespace Express {
  interface Request {
    user?: {
      id: string;
      userId: string;
      role: string;
    };
  }
}
