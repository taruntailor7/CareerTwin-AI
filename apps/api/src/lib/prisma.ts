import { env } from "../config/env.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let prismaClient: { [key: string]: unknown } | null = null;

export function getPrismaClient(): { [key: string]: unknown } | null {
  if (!env.USE_DATABASE || !env.DATABASE_URL) {
    return null;
  }
  if (!prismaClient) {
    // Prisma 7 client may not be generated in local hackathon mode.
    // Fall back safely when unavailable.
    try {
      const prismaModule = require("@prisma/client") as { PrismaClient?: new () => { [key: string]: unknown } };
      if (prismaModule.PrismaClient) {
        prismaClient = new prismaModule.PrismaClient();
      }
    } catch {
      prismaClient = null;
    }
  }
  return prismaClient;
}
