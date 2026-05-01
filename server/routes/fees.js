import { Router } from 'express';
import { getFees } from '../services/reportStore.js';
import { computeSummary } from '../parsers/feeReport.js';
import logger from '../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows: allRows, summary: cachedSummary } = getFees();

    let rows = allRows;
    if (req.query.balanceAccountId) {
      rows = rows.filter(r => r.balanceAccount === req.query.balanceAccountId);
    }
    if (req.query.startDate) {
      const start = new Date(req.query.startDate);
      rows = rows.filter(r => new Date(r.billingMonth) >= start);
    }
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      rows = rows.filter(r => new Date(r.billingMonth) <= end);
    }

    // Use the cached summary when no account filter is applied; otherwise recompute
    const summary = req.query.balanceAccountId ? computeSummary(rows) : cachedSummary;

    res.json({
      data: rows,
      summary,
      meta: {
        count: rows.length,
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
