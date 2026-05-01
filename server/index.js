import express from 'express';
import cors from 'cors';
import logger from './services/logger.js';

// Import reportStore first — this triggers all CSV parsing at startup.
// Routes are registered after so they can safely call store getters immediately.
import './services/reportStore.js';

import transactionsRouter from './routes/transactions.js';
import payoutsRouter from './routes/payouts.js';
import feesRouter from './routes/fees.js';
import statementRouter from './routes/statement.js';
import profitabilityRouter from './routes/platform/profitability.js';
import transactionProfitabilityRouter from './routes/platform/transactionProfitability.js';
import userProfitabilityRouter from './routes/platform/userProfitability.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/transactions', transactionsRouter);
app.use('/api/payouts', payoutsRouter);
app.use('/api/fees', feesRouter);
app.use('/api/statement', statementRouter);
app.use('/api/platform/profitability', profitabilityRouter);
app.use('/api/platform/transaction-profitability', transactionProfitabilityRouter);
app.use('/api/platform/user-profitability', userProfitabilityRouter);

app.listen(PORT, () => {
  logger.info(`Server ready on port ${PORT}`);
});
