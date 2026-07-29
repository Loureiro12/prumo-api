import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/httpError';

interface CardInput {
  name: string; institution: string; limit: number;
  closingDay: number; dueDay: number; color: string; lastFourDigits?: string;
}

export function create(userId: string, data: CardInput) {
  return prisma.creditCard.create({ data: { ...data, userId } });
}

export async function listWithUsage(userId: string) {
  const cards = await prisma.creditCard.findMany({
    where: { userId },
    include: { invoices: { orderBy: { referenceMonth: 'asc' } } },
  });
  const result = [];
  for (const card of cards) {
    type Invoice = (typeof card.invoices)[number];
    const unpaidInvoiceIds = card.invoices
      .filter((i: Invoice) => i.status !== 'paid')
      .map((i: Invoice) => i.id);
    const used = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        creditCardId: card.id,
        paymentMethod: 'credit_card',
        invoiceId: { in: unpaidInvoiceIds },
      },
    });
    const usedLimit = used._sum.amount ?? 0;
    result.push({
      ...card,
      usedLimit,
      availableLimit: card.limit - usedLimit,
      bestPurchaseDay: card.closingDay >= 28 ? 1 : card.closingDay + 1,
    });
  }
  return result;
}

export async function invoiceDetail(userId: string, invoiceId: string) {
  const invoice = await prisma.creditCardInvoice.findFirst({
    where: { id: invoiceId, creditCard: { userId } },
    include: { transactions: { orderBy: { date: 'asc' } } },
  });
  if (!invoice) throw notFound('Fatura não encontrada');
  type Tx = (typeof invoice.transactions)[number];
  const total = invoice.transactions.reduce((s: number, t: Tx) => s + t.amount, 0);
  return { ...invoice, total };
}

/** Regra 3: pagar fatura debita a conta escolhida e fecha a fatura. */
export async function payInvoice(userId: string, invoiceId: string, accountId: string) {
  const invoice = await prisma.creditCardInvoice.findFirst({
    where: { id: invoiceId, status: { not: 'paid' }, creditCard: { userId } },
    include: { transactions: true, creditCard: true },
  });
  if (!invoice) throw notFound('Fatura não encontrada ou já paga');
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw notFound('Conta não encontrada');

  type PayTx = (typeof invoice.transactions)[number];
  const total = invoice.transactions
    .filter((t: PayTx) => t.paymentMethod === 'credit_card')
    .reduce((s: number, t: PayTx) => s + t.amount, 0);

  return prisma.$transaction([
    prisma.creditCardInvoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidWithAccountId: accountId, paidAt: new Date() },
    }),
    prisma.transaction.create({
      data: {
        userId, type: 'expense', amount: total,
        description: `Pagamento fatura ${invoice.creditCard.name}`,
        date: new Date(), status: 'paid',
        paymentMethod: 'account', accountId, invoiceId,
      },
    }),
  ]);
}
