import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.REDSHIFT_HOST,
      port: Number(process.env.REDSHIFT_PORT) || 5439,
      database: process.env.REDSHIFT_DB,
      user: process.env.REDSHIFT_USER,
      password: process.env.REDSHIFT_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
