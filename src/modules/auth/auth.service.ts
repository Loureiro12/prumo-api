import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { conflict, unauthorized } from '../../lib/httpError';

interface RegisterInput {
  name: string; email: string; password: string;
  monthlyIncome?: number; goal?: string; hasDebts?: boolean;
}

function sign(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

export async function register(input: RegisterInput): Promise<{ token: string }> {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict('E-mail já cadastrado');
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
      monthlyIncome: input.monthlyIncome ?? 0,
      goal: input.goal ?? 'organize',
      hasDebts: input.hasDebts ?? false,
    },
  });
  return { token: sign(user.id) };
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('E-mail ou senha incorretos');
  }
  return { token: sign(user.id) };
}
