import { prisma } from '../../lib/prisma';
import { accountBalance } from '../../domain/finance';
import { notFound } from '../../lib/httpError';

export async function listWithBalances(userId: string) {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({ where: { userId, archived: false } }),
    prisma.transaction.findMany({
      where: { userId },
      select: {
        type: true, status: true, paymentMethod: true,
        amount: true, accountId: true, toAccountId: true,
      },
    }),
  ]);
  return accounts.map((a: (typeof accounts)[number]) => ({
    ...a,
    balance: accountBalance(a.initialBalance, a.id, transactions),
  }));
}

interface AccountInput {
  name: string; institution: string; type: string;
  initialBalance: number; color: string; icon: string;
}

export function create(userId: string, data: AccountInput) {
  return prisma.account.create({ data: { ...data, userId } });
}

export async function update(userId: string, id: string, data: Partial<AccountInput>) {
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw notFound('Conta não encontrada');
  return prisma.account.update({ where: { id }, data });
}

export async function archive(userId: string, id: string) {
  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) throw notFound('Conta não encontrada');
  return prisma.account.update({ where: { id }, data: { archived: true } });
}
