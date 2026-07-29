import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import jwksClient from 'jwks-rsa';
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env, googleClientIds } from '../../config/env';
import { conflict, unauthorized, HttpError } from '../../lib/httpError';

interface RegisterInput {
  name: string; email: string; password: string;
  monthlyIncome?: number; goal?: string; hasDebts?: boolean;
}

export type PublicUser = Omit<User, 'passwordHash' | 'googleId' | 'appleId'>;

function sign(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, googleId: _googleId, appleId: _appleId, ...rest } = user;
  return rest;
}

export async function register(input: RegisterInput): Promise<{ token: string; user: PublicUser }> {
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
  return { token: sign(user.id), user: toPublicUser(user) };
}

export async function login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('E-mail ou senha incorretos');
  }
  return { token: sign(user.id), user: toPublicUser(user) };
}

async function findOrCreateSocialUser(params: {
  provider: 'googleId' | 'appleId';
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<User> {
  const { provider, providerId, email, name, avatarUrl } = params;
  const providerWhere = provider === 'googleId' ? { googleId: providerId } : { appleId: providerId };
  const providerData = provider === 'googleId' ? { googleId: providerId } : { appleId: providerId };

  const byProvider = await prisma.user.findUnique({ where: providerWhere });
  if (byProvider) return byProvider;

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({ where: { id: byEmail.id }, data: providerData });
  }

  return prisma.user.create({
    data: { name, email, avatarUrl, ...providerData },
  });
}

let googleClient: OAuth2Client | null = null;

export async function loginWithGoogle(idToken: string): Promise<{ token: string; user: PublicUser }> {
  if (googleClientIds.length === 0) {
    throw new HttpError(501, 'Login com Google não está configurado no servidor');
  }
  googleClient ??= new OAuth2Client();
  const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientIds });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw unauthorized('Token do Google inválido');

  const user = await findOrCreateSocialUser({
    provider: 'googleId',
    providerId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split('@')[0],
    avatarUrl: payload.picture,
  });
  return { token: sign(user.id), user: toPublicUser(user) };
}

const appleKeyClient = jwksClient({ jwksUri: 'https://appleid.apple.com/auth/keys' });

interface AppleTokenPayload {
  sub: string;
  email?: string;
}

async function verifyAppleIdentityToken(identityToken: string): Promise<AppleTokenPayload> {
  const decoded = jwt.decode(identityToken, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined;
  if (!kid) throw unauthorized('Token da Apple inválido');

  const key = await appleKeyClient.getSigningKey(kid);
  const publicKey = key.getPublicKey();

  return new Promise((resolve, reject) => {
    jwt.verify(
      identityToken,
      publicKey,
      { algorithms: ['RS256'], audience: env.APPLE_CLIENT_ID, issuer: 'https://appleid.apple.com' },
      (err, payload) => {
        if (err || !payload || typeof payload === 'string') {
          reject(unauthorized('Token da Apple inválido ou expirado'));
          return;
        }
        resolve(payload as unknown as AppleTokenPayload);
      },
    );
  });
}

export async function loginWithApple(
  identityToken: string,
  name?: { firstName?: string; lastName?: string },
): Promise<{ token: string; user: PublicUser }> {
  if (!env.APPLE_CLIENT_ID) {
    throw new HttpError(501, 'Login com Apple não está configurado no servidor');
  }
  const payload = await verifyAppleIdentityToken(identityToken);
  const email = payload.email ?? `${payload.sub}@appleid.private`;
  const fullName = [name?.firstName, name?.lastName].filter(Boolean).join(' ');

  const user = await findOrCreateSocialUser({
    provider: 'appleId',
    providerId: payload.sub,
    email,
    name: fullName || email.split('@')[0],
  });
  return { token: sign(user.id), user: toPublicUser(user) };
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  return toPublicUser(user);
}

interface ProfilePatch {
  name?: string; monthlyIncome?: number; goal?: string;
  hasDebts?: boolean; onboarded?: boolean;
}

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<PublicUser> {
  const user = await prisma.user.update({ where: { id: userId }, data: patch });
  return toPublicUser(user);
}
