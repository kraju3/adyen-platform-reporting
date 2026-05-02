import { Router } from 'express';
import { getAccountingFinal, getFees } from '../../services/reportStore.js';
import logger from '../../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const finalRows = getAccountingFinal();
    const { rows: feeRows } = getFees();

    // Pre-compute total fees per AccountHolder from the Fee Report
    const feeTotalByAH = {};
    for (const f of feeRows) {
      feeTotalByAH[f.accountHolder] = Math.round(
        ((feeTotalByAH[f.accountHolder] || 0) + f.amount) * 100
      ) / 100;
    }

    // Aggregate per sub-merchant (exclude the liable platform account)
    const merchantMap = {};

    for (const r of finalRows) {
      const ah = r.accountHolder;

      if (!merchantMap[ah]) {
        merchantMap[ah] = {
          accountHolder: ah,
          balanceAccount: r.balanceAccount,
          volume: 0,
          txnCount: 0,
          commission: 0,
        };
      }

      const m = merchantMap[ah];

      if (r.category === 'platformPayment' && r.status === 'captured') {
        m.volume = Math.round((m.volume + r.amount) * 100) / 100;
        m.txnCount++;
      }

      // Commission = absolute value of fee debits on the sub-merchant account.
      // These are the commission amounts taken by the platform per transaction.
      if (r.category === 'internal' && r.type === 'fee' && r.amount < 0) {
        m.commission = Math.round((m.commission + Math.abs(r.amount)) * 100) / 100;
      }
    }

    const result = Object.values(merchantMap).map(m => {
      const fees = feeTotalByAH[m.accountHolder] || 0;
      const profit = Math.round((m.commission - fees) * 100) / 100;
      const effectiveRate = m.volume > 0
        ? Math.round((profit / m.volume) * 10000) / 100
        : 0;

      return {
        accountHolder: m.accountHolder,
        balanceAccount: m.balanceAccount,
        merchantName: MERCHANT_NAMES[m.accountHolder] || m.accountHolder,
        volume: m.volume,
        txnCount: m.txnCount,
        commission: m.commission,
        fees,
        profit,
        effectiveRate,
      };
    });

    // Default sort: profit descending (most profitable first)
    result.sort((a, b) => b.profit - a.profit);

    res.json({
      data: result,
      meta: { count: result.length, filters: {} },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
