import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

// Next.js dev 모드는 모듈을 자주 다시 평가해서, 매번 새 PrismaClient를 만들면
// 커넥션이 계속 쌓인다. globalThis에 캐싱해서 hot-reload에도 인스턴스를 재사용한다.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
