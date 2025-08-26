// Augment Express Request object to include the `user` property that our auth middleware sets.
declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      userId: string; // duplicate of id for convenience across codebase
      role: string;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      /** JWT-decoded user payload attached by `authenticateToken` middleware */
      user?: UserPayload;
    }
  }
}

export {};
