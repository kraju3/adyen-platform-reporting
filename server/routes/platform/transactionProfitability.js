import { Router } from 'express';
import { getAccountingAll, getFees } from '../../services/reportStore.js';
import { MERCHANT_NAMES, LIABLE_BALANCE_ACCOUNT } from '../../constants/merchants.js';
import logger from '../../services/logger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const allRows = getAccountingAll();
    const { rows: feeRows } = getFees();

    // Pre-compute per-AccountHolder fee totals and transaction counts for cost approximation.
    // The Fee Report is monthly — we divide total fees by txn count to get a per-txn estimate.
    const feeTotalByAH = {};
    for (const f of feeRows) {
      feeTotalByAH[f.accountHolder] = Math.round(
        ((feeTotalByAH[f.accountHolder] || 0) + f.amount) * 100
      ) / 100;
    }

    // Build a map of sub-merchant captured transactions by Transfer Id
    const capturedByTransferId = new Map();
    for (const r of allRows) {
      if (r.category === 'platformPayment' && r.status === 'captured' && r.txnId) {
        capturedByTransferId.set(r.transferId, r);
      }
    }

    // Count captured transactions per AccountHolder for fee allocation
    const txnCountByAH = {};
    for (const r of capturedByTransferId.values()) {
      txnCountByAH[r.accountHolder] = (txnCountByAH[r.accountHolder] || 0) + 1;
    }

    // Commission fee debits on sub-merchant accounts link to captured transactions
    // via pspRef — the fee Transfer Id differs from the capture Transfer Id.
    // We use pspRef as the join key between the two entries.
    const feeDebitByPspRef = new Map();
    for (const r of allRows) {
      if (
        r.category === 'internal' &&
        r.type === 'fee' &&
        r.amount < 0 &&
        r.balanceAccount !== LIABLE_BALANCE_ACCOUNT &&
        r.pspRef
      ) {
        feeDebitByPspRef.set(r.pspRef, r);
      }
    }

    const result = [];
    for (const [transferId, captured] of capturedByTransferId) {
      const feeRow = feeDebitByPspRef.get(captured.pspRef);
      if (!feeRow) continue; // skip if no matching commission entry

      const commission = Math.round(Math.abs(feeRow.amount) * 100) / 100;
      const totalFees = feeTotalByAH[captured.accountHolder] || 0;
      const count = txnCountByAH[captured.accountHolder] || 1;
      const estimatedCost = Math.round((totalFees / count) * 100) / 100;
      const profit = Math.round((commission - estimatedCost) * 100) / 100;
      const marginPercent = captured.amount !== 0
        ? Math.round((profit / captured.amount) * 10000) / 100
        : 0;

      result.push({
        pspRef: captured.pspRef,
        transferId,
        valueDate: captured.valueDate?.split('T')[0] || null,
        accountHolder: captured.accountHolder,
        merchantName: MERCHANT_NAMES[captured.accountHolder] || captured.accountHolder,
        amount: captured.amount,
        commission,
        fees: estimatedCost,
        profit,
        marginPercent,
      });
    }

    // Default sort: margin ascending (worst performers first — most useful for operators)
    result.sort((a, b) => a.marginPercent - b.marginPercent);

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
