import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Use URL API to cleanly remove channel_binding — the pg driver doesn't support it.
  // Simple regex replacement can produce malformed URLs (e.g. "...db&sslmode=require").
  let cleanUrl = connectionString;
  try {
    const u = new URL(connectionString);
    u.searchParams.delete("channel_binding");
    cleanUrl = u.toString();
  } catch {
    // Fallback: strip manually if URL parsing fails
    cleanUrl = connectionString
      .replace(/[?&]channel_binding=[^&]*/g, "")
      .replace(/\?&/, "?");
  }

  const adapter = new PrismaPg({ connectionString: cleanUrl });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
