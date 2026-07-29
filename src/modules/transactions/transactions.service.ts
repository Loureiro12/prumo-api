import { prisma } from '../../lib/prisma';
import {
  addMonthsToRef, invoiceDates, invoiceMonthForPurchase, splitInstallments,
} from '../../domain/finance';
import { badRequest, notFound } from '../../lib/httpError';

interface ListFilters {
  month?: string; type?: string; accountId?: string;
  creditCardId?: string; search?: string;
}

export function list(userId: string, filters: ListFilters) {
  const range = filters.month
    ? {
        gte: new Date(`${filters.month}-01T00:00:00.000Z`),
        lt: new Date(addMonthsToRef(filters.month, 1) + '-01T00:00:00.000Z'),
      }
    : undefined;
  return prisma.transaction.findMany({
    where: {
      userId,
      ...(range ? { date: range } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.creditCardId ? { creditCardId: filters.creditCardId } : {}),
      ...(filters.search ? { description: { contains: filters.search } } : {}),
    },
    orderBy: { date: 'desc' },
  });
}

async function ensureInvoice(creditCardId: string, referenceMonth: string) {
  const card = await prisma.creditCard.findUnique({ where: { id: creditCardId } });
  if (!card) throw notFound('Cartão não encontrado');
  const dates = invoiceDates(referenceMonth, card.closingDay, card.dueDay);
  return prisma.creditCardInvoice.upsert({
    where: { creditCardId_referenceMonth: { creditCardId, referenceMonth } },
    create: { creditCardId, referenceMonth, ...dates },
    update: {},
  });
}

interface ExpenseInput {
  amount: number; description: string; categoryId?: string; date: string;
  paymentMethod: 'account' | 'credit_card'; accountId?: string;
  creditCardId?: string; installments?: number; note?: string;
  status?: 'paid' | 'pending';
}

/** Regras 1, 2 e 6: conta debita na hora; cartão vai para faturas, com parcelas. */
export async function createExpense(userId: string, input: ExpenseInput) {
  if (input.paymentMethod === 'account') {
    if (!input.accountId) throw badRequest('Informe a conta');
    return prisma.transaction.create({
      data: {
        userId, type: 'expense', amount: input.amount,
        description: input.description, categoryId: input.categoryId,
        date: new Date(input.date), status: input.status ?? 'paid',
        paymentMethod: 'account', accountId: input.accountId, note: input.note,
      },
    });
  }

  if (!input.creditCardId) throw badRequest('Informe o cartão');
  const card = await prisma.creditCard.findFirst({
    where: { id: input.creditCardId, userId },
  });
  if (!card) throw notFound('Cartão não encontrado');

  const count = input.installments && input.installments > 1 ? input.installments : 1;
  const amounts = splitInstallments(input.amount, count);
  const firstMonth = invoiceMonthForPurchase(new Date(input.date), card.closingDay);
  const groupId = count > 1 ? crypto.randomUUID() : null;

  return prisma.$transaction(async () => {
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const ref = addMonthsToRef(firstMonth, i);
      const invoice = await ensureInvoice(card.id, ref);
      created.push(await prisma.transaction.create({
        data: {
          userId, type: 'expense', amount: amounts[i],
          description: input.description, categoryId: input.categoryId,
          date: i === 0 ? new Date(input.date) : new Date(`${ref}-01T12:00:00.000Z`),
          status: 'paid', paymentMethod: 'credit_card',
          creditCardId: card.id, invoiceId: invoice.id,
          installmentGroupId: groupId,
          installmentNumber: count > 1 ? i + 1 : null,
          installmentTotal: count > 1 ? count : null,
          note: input.note,
        },
      }));
    }
    return created;
  });
}

interface IncomeInput {
  amount: number; description: string; categoryId?: string;
  date: string; accountId: string; status?: 'paid' | 'pending';
}

export function createIncome(userId: string, input: IncomeInput) {
  return prisma.transaction.create({
    data: {
      userId, type: 'income', amount: input.amount,
      description: input.description, categoryId: input.categoryId,
      date: new Date(input.date), status: input.status ?? 'paid',
      paymentMethod: 'account', accountId: input.accountId,
    },
  });
}

interface TransferInput { amount: number; accountId: string; toAccountId: string; date: string }

/** Regras 4 e 10. */
export function createTransfer(userId: string, input: TransferInput) {
  if (input.accountId === input.toAccountId) {
    throw badRequest('A conta de destino deve ser diferente da origem');
  }
  return prisma.transaction.create({
    data: {
      userId, type: 'transfer', amount: input.amount,
      description: 'Transferência entre contas',
      date: new Date(input.date), status: 'paid', paymentMethod: 'account',
      accountId: input.accountId, toAccountId: input.toAccountId,
    },
  });
}

export async function markAsPaid(userId: string, id: string) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw notFound('Lançamento não encontrado');
  return prisma.transaction.update({ where: { id }, data: { status: 'paid' } });
}

/** Regra 9: excluir uma parcela remove o grupo inteiro para manter faturas íntegras. */
export async function remove(userId: string, id: string) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw notFound('Lançamento não encontrado');
  if (tx.installmentGroupId) {
    await prisma.transaction.deleteMany({
      where: { userId, installmentGroupId: tx.installmentGroupId },
    });
  } else {
    await prisma.transaction.delete({ where: { id } });
  }
}
