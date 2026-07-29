/**
 * Regras financeiras compartilhadas do backend.
 * Espelham as regras do app para manter consistência entre cliente e servidor.
 */

/** Divide um valor em parcelas sem perder centavos (primeira absorve o resto). */
export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i === 0 ? remainder : 0)) / 100);
}

/** Fatura (YYYY-MM) de uma compra conforme o dia de fechamento do cartão. */
export function invoiceMonthForPurchase(date: Date, closingDay: number): string {
  const shift = date.getUTCDate() >= closingDay ? 1 : 0;
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + shift, 1));
  return d.toISOString().slice(0, 7);
}

export function addMonthsToRef(referenceMonth: string, months: number): string {
  const [y, m] = referenceMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
}

export function invoiceDates(referenceMonth: string, closingDay: number, dueDay: number): {
  closingDate: Date; dueDate: Date;
} {
  const [y, m] = referenceMonth.split('-').map(Number);
  const closingDate = new Date(Date.UTC(y, m - 1, closingDay));
  const dueShift = dueDay > closingDay ? 0 : 1;
  const dueDate = new Date(Date.UTC(y, m - 1 + dueShift, dueDay));
  return { closingDate, dueDate };
}

// ----------------------------------------------------------- recorrentes

interface RecurringLike {
  id: string; active: boolean; startDate: Date; endDate: Date | null;
  type: string; amount: number; description: string; categoryId: string | null;
  dueDay: number; paymentMethod: string; accountId: string | null; creditCardId: string | null;
}

interface ExistingRecurringTx {
  recurringId: string | null;
  date: Date;
}

export interface DueRecurringResult {
  type: string; amount: number; description: string; categoryId: string | null;
  date: Date; status: 'pending'; paymentMethod: string;
  accountId: string | null; creditCardId: string | null; recurringId: string;
}

function monthKeyOfDate(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Regra 7: gera o lançamento pendente do mês para cada conta fixa ativa. */
export function dueRecurringForMonth(
  recurring: RecurringLike[], existing: ExistingRecurringTx[], month: string,
): DueRecurringResult[] {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  return recurring
    .filter((r) => r.active && monthKeyOfDate(r.startDate) <= month &&
      (!r.endDate || monthKeyOfDate(r.endDate) >= month))
    .filter((r) => !existing.some((t) => t.recurringId === r.id && monthKeyOfDate(t.date) === month))
    .map((r) => ({
      type: r.type,
      amount: r.amount,
      description: r.description,
      categoryId: r.categoryId,
      date: new Date(Date.UTC(y, m - 1, Math.min(r.dueDay, lastDay))),
      status: 'pending' as const,
      paymentMethod: r.paymentMethod,
      accountId: r.accountId,
      creditCardId: r.creditCardId,
      recurringId: r.id,
    }));
}

interface BalanceTx {
  type: string;
  status: string;
  paymentMethod: string;
  amount: number;
  accountId: string | null;
  toAccountId: string | null;
}

/** Saldo derivado de uma conta — apenas lançamentos pagos via conta. */
export function accountBalance(
  initialBalance: number, accountId: string, transactions: BalanceTx[],
): number {
  return transactions.reduce((balance, t) => {
    if (t.status !== 'paid') return balance;
    if (t.type === 'transfer') {
      if (t.accountId === accountId) return balance - t.amount;
      if (t.toAccountId === accountId) return balance + t.amount;
      return balance;
    }
    if (t.paymentMethod !== 'account' || t.accountId !== accountId) return balance;
    return t.type === 'income' ? balance + t.amount : balance - t.amount;
  }, initialBalance);
}
