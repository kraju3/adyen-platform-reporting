import { Router } from 'express';
import { getAccountingAll } from '../../services/reportStore.js';
import { MERCHANT_NAMES } from '../../constants/merchants.js';
import logger from '../../services/logger.js';

const router = Router();

// Groups all BP Accounting rows by Transfer Id.
// A complete transfer has at least one row with a Transaction Id (final-status row).
// A transfer missing any Transaction Id row never reached final settlement.
router.get('/', async (req, res) => {
  try {
    const allRows = getAccountingAll();

    // Group rows by Transfer Id, tracking which statuses are present
    const transferMap = new Map();
    for (const r of allRows) {
      const tid = r.transferId;
      if (!tid) continue;

      if (!transferMap.has(tid)) {
        transferMap.set(tid, {
          transferId: tid,
          accountHolder: r.accountHolder,
          balanceAccount: r.balanceAccount,
          type: r.type,
          category: r.category,
          amount: r.amount,
          statuses: new Set(),
          hasFinalStatus: false,
          txnId: null,
        });
      }

      const entry = transferMap.get(tid);
      entry.statuses.add(r.status);
      if (r.txnId) {
        entry.hasFinalStatus = true;
        entry.txnId = r.txnId;
        // Use the final-status row's amount as the canonical amount
        entry.amount = r.amount;
      }
    }

    const complete = [];
    const incomplete = [];

    for (const entry of transferMap.values()) {
      const statusList = Array.from(entry.statuses);
      const row = {
        transferId: entry.transferId,
        accountHolder: entry.accountHolder,
        balanceAccount: entry.balanceAccount,
        merchantName: MERCHANT_NAMES[entry.accountHolder] || entry.accountHolder,
        type: entry.type,
        category: entry.category,
        amount: entry.amount,
        statusesPresent: statusList,
      };

      if (entry.hasFinalStatus) {
        complete.push({ ...row, txnId: entry.txnId });
      } else {
        const expectedFinalStatus = entry.category === 'platformPayment'
          ? 'captured/refunded/chargeback'
          : entry.type === 'fee'
          ? 'fee'
          : 'booked';

        incomplete.push({
          ...row,
          missingStatus: expectedFinalStatus,
          reason: 'No Transaction Id found — transfer never reached final settlement status',
        });
      }
    }

    res.json({
      complete,
      incomplete,
      summary: {
        total: transferMap.size,
        complete: complete.length,
        incomplete: incomplete.length,
      },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
