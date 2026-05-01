import { Router } from 'express';
import { getStatements } from '../services/reportStore.js';
import { MERCHANT_NAMES } from '../constants/merchants.js';
import logger from '../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let statements = getStatements();

    if (req.query.balanceAccountId) {
      statements = statements.filter(s => s.balanceAccount === req.query.balanceAccountId);
    }

    const data = statements.map(s => ({
      accountHolder: s.accountHolder,
      balanceAccount: s.balanceAccount,
      merchantName: MERCHANT_NAMES[s.accountHolder] || s.accountHolder,
      openingBalance: s.openingBalance,
      closingBalance: s.closingBalance,
      transactionCount: s.transactions.length,
      transactions: s.transactions,
    }));

    res.json({
      data,
      meta: {
        count: data.length,
        filters: {
          balanceAccountId: req.query.balanceAccountId || null,
          startDate: null,
          endDate: null,
        },
      },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
