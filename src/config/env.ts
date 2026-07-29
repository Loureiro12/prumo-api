import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET precisa ter ao menos 8 caracteres'),
  PORT: z.coerce.number().default(3333),
  GOOGLE_CLIENT_IDS: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
});

export const env = schema.parse(process.env);

export const googleClientIds =
  env.GOOGLE_CLIENT_IDS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
