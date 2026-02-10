import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 为无服务器环境（Vercel）创建单一连接
const queryClient = postgres(process.env.DATABASE_URL!);

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
