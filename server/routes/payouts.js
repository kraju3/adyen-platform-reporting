import { Router } from 'express';
import { getPayoutBatches } from '../services/reportStore.js';
import { MERCHANT_NAMES } from '../constants/merchants.js';
import logger from '../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    let batches = getPayoutBatches();

    if (req.query.balanceAccountId) {
      batches = batches.filter(b => b.balanceAccount === req.query.balanceAccountId);
    }
    if (req.query.startDate) {
      const start = new Date(req.query.startDate);
      batches = batches.filter(b => new Date(b.payoutDate) >= start);
    }
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      batches = batches.filter(b => new Date(b.payoutDate) <= end);
    }

    // Sort by payoutDate descending
    batches = batches.slice().sort((a, b) => new Date(b.payoutDate) - new Date(a.payoutDate));

    const data = batches.map(b => ({
      payoutDate: b.payoutDate,
      accountHolder: b.accountHolder,
      balanceAccount: b.balanceAccount,
      merchantName: MERCHANT_NAMES[b.accountHolder] || b.accountHolder,
      totalAmount: b.disbursement
        ? Math.abs(b.disbursement.amount)
        : Math.round(b.transactions.reduce((s, t) => s + t.amount, 0) * 100) / 100,
      transactionCount: b.transactions.length,
      transactions: b.transactions,
      disbursement: b.disbursement,
    }));

    res.json({
      data,
      meta: {
        count: data.length,
        filters: {
          balanceAccountId: req.query.balanceAccountId || null,
          startDate: req.query.startDate || null,
          endDate: req.query.endDate || null,
        },
      },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
