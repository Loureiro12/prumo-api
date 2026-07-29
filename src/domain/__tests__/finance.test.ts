import { describe, expect, it } from 'vitest';
import {
  accountBalance, invoiceMonthForPurchase, splitInstallments,
} from '../finance';

describe('regras financeiras (API)', () => {
  it('parcelas somam o total sem perder centavos', () => {
    expect(splitInstallments(1200, 6).reduce((s, p) => s + p, 0)).toBeCloseTo(1200);
    expect(splitInstallments(100, 3).reduce((s, p) => s + p, 0)).toBeCloseTo(100);
    expect(splitInstallments(0.05, 2)).toEqual([0.03, 0.02]);
  });

  it('compra no/após o fechamento cai na fatura seguinte', () => {
    expect(invoiceMonthForPurchase(new Date('2026-07-02T12:00:00Z'), 3)).toBe('2026-07');
    expect(invoiceMonthForPurchase(new Date('2026-07-03T12:00:00Z'), 3)).toBe('2026-08');
    expect(invoiceMonthForPurchase(new Date('2026-12-31T12:00:00Z'), 3)).toBe('2027-01');
  });

  it('saldo só considera lançamentos pagos via conta', () => {
    const txs = [
      { type: 'expense', status: 'paid', paymentMethod: 'account', amount: 200, accountId: 'a', toAccountId: null },
      { type: 'expense', status: 'pending', paymentMethod: 'account', amount: 300, accountId: 'a', toAccountId: null },
      { type: 'expense', status: 'paid', paymentMethod: 'credit_card', amount: 500, accountId: null, toAccountId: null },
      { type: 'income', status: 'paid', paymentMethod: 'account', amount: 100, accountId: 'a', toAccountId: null },
      { type: 'transfer', status: 'paid', paymentMethod: 'account', amount: 50, accountId: 'a', toAccountId: 'b' },
    ];
    expect(accountBalance(1000, 'a', txs)).toBe(850);
    expect(accountBalance(0, 'b', txs)).toBe(50);
  });
});
