import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  FPL_API_BASE: z.string().url().default("https://fantasy.premierleague.com/api"),
  CACHE_DIR: z.string().default("./.cache"),
  CACHE_TTL_BOOTSTRAP_MS: z.coerce.number().default(1_800_000),
  CACHE_TTL_FIXTURES_MS: z.coerce.number().default(21_600_000),
  CACHE_TTL_ENTRY_MS: z.coerce.number().default(120_000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  DEFAULT_TEAM_ID: z.coerce.number().default(8090938)
});

export const env = envSchema.parse(process.env);
