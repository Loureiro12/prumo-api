import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET precisa ter ao menos 8 caracteres'),
  PORT: z.coerce.number().default(3333),
});

export const env = schema.parse(process.env);
