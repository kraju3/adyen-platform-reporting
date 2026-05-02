import { Router } from 'express';
import { getPaymentAccountingSettled, getAccountingAll } from '../../services/reportStore.js';
import { MERCHANT_NAMES } from '../../constants/merchants.js';
import logger from '../../services/logger.js';

const router = Router();

// Join Payment Accounting Settled rows (which have fee columns) to BP Accounting
// internal/fee rows by PSP Reference. Flag if total fee difference > $0.01.
router.get('/', async (req, res) => {
  try {
    const settledRows = getPaymentAccountingSettled();
    const allAccounting = getAccountingAll();

    // The PSP Reference values differ between Payment Accounting and BP Accounting in the
    // mock data. Join on merchantReference (which is consistent across both systems).
    const bpFeesByMerchantRef = new Map();
    for (const r of allAccounting) {
      if (r.category === 'internal' && r.type === 'fee' && r.merchantRef) {
        const existing = bpFeesByMerchantRef.get(r.merchantRef) || { totalFees: 0 };
        // Only count sub-merchant side fee debits (negative amounts, non-liable account)
        if (r.amount < 0) {
          existing.totalFees = Math.round((existing.totalFees + Math.abs(r.amount)) * 100) / 100;
        }
        bpFeesByMerchantRef.set(r.merchantRef, existing);
      }
    }

    const matched = [];
    const discrepancies = [];
    let totalFeeVariance = 0;

    for (const s of settledRows) {
      const paFees = Math.round(
        (s.interchangeSC + s.schemeFeesSC + s.markupSC + s.commissionSC) * 100
      ) / 100;
      const bpEntry = bpFeesByMerchantRef.get(s.merchantReference);
      const bpFees = bpEntry ? bpEntry.totalFees : 0;
      const variance = Math.round((paFees - bpFees) * 100) / 100;

      const row = {
        pspRef: s.pspReference,
        merchantRef: s.merchantReference,
        merchantAccount: s.merchantAccount,
        paymentAccountingFees: paFees,
        bpAccountingFees: bpFees,
        variance,
        breakdown: {
          interchange: s.interchangeSC,
          schemeFees: s.schemeFeesSC,
          markup: s.markupSC,
          commission: s.commissionSC,
        },
      };

      if (Math.abs(variance) > 0.01) {
        discrepancies.push(row);
        totalFeeVariance = Math.round((totalFeeVariance + variance) * 100) / 100;
      } else {
        matched.push(row);
      }
    }

    res.json({
      matched,
      discrepancies,
      summary: {
        total: settledRows.length,
        matched: matched.length,
        discrepancies: discrepancies.length,
        totalFeeVariance,
      },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
