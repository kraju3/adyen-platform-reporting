import { Router } from 'express';
import { getAccountingFinal } from '../services/reportStore.js';
import logger from '../services/logger.js';

const router = Router();

// Only merchantPayment and bank categories are merchant-visible transactions.
// Internal fee/adjustment rows are accounting entries, not transaction events.
const VISIBLE_CATEGORIES = new Set(['platformPayment', 'bank', 'card']);

router.get('/', async (req, res) => {
  try {
    let data = getAccountingFinal().filter(r => VISIBLE_CATEGORIES.has(r.category));

    if (req.query.balanceAccountId) {
      data = data.filter(r => r.balanceAccount === req.query.balanceAccountId);
    }
    if (req.query.startDate) {
      const start = new Date(req.query.startDate);
      data = data.filter(r => new Date(r.bookingDate) >= start);
    }
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter(r => new Date(r.bookingDate) <= end);
    }

    // Sort by bookingDate descending (most recent first)
    data = data.slice().sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

    res.json({
      data: data.map(r => ({
        transferId: r.transferId,
        txnId: r.txnId,
        accountHolder: r.accountHolder,
        balanceAccount: r.balanceAccount,
        merchantRef: r.merchantRef,
        pspRef: r.pspRef,
        category: r.category,
        type: r.type,
        status: r.status,
        bookingDate: r.bookingDate,
        valueDate: r.valueDate,
        currency: r.currency,
        amount: r.amount,
      })),
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
