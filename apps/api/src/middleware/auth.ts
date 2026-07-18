import type { NextFunction, Request, Response } from "express";

export interface AuthenticatedRequest extends Request {
  authUserId: string;
}

export function requireUserAuth(req: Request, res: Response, next: NextFunction) {
  const authUserId = req.header("x-clerk-user-id");
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized request: missing user identity." });
  }
  (req as AuthenticatedRequest).authUserId = authUserId;
  next();
}
