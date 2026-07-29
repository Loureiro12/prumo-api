import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRoutes } from './modules/auth/auth.routes';
import { accountsRoutes } from './modules/accounts/accounts.routes';
import { cardsRoutes } from './modules/cards/cards.routes';
import { transactionsRoutes } from './modules/transactions/transactions.routes';
import { recurringRoutes } from './modules/recurring/recurring.routes';
import { debtsRoutes } from './modules/debts/debts.routes';
import { goalsRoutes } from './modules/goals/goals.routes';
import { requireAuth } from './middlewares/auth';
import { errorHandler } from './middlewares/errorHandler';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/accounts', requireAuth, accountsRoutes);
app.use('/cards', requireAuth, cardsRoutes);
app.use('/transactions', requireAuth, transactionsRoutes);
app.use('/recurring', requireAuth, recurringRoutes);
app.use('/debts', requireAuth, debtsRoutes);
app.use('/goals', requireAuth, goalsRoutes);

app.use(errorHandler);
