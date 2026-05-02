import { Router } from 'express';
import { getPaymentAccountingSentForSettle, getAccountingAll } from '../../services/reportStore.js';
import { MERCHANT_NAMES } from '../../constants/merchants.js';
import logger from '../../services/logger.js';

const router = Router();

// Join Payment Accounting SentForSettle rows to BP Accounting captured rows by PSP Reference.
// A SentForSettle row with no matching captured row in BP Accounting = reconciliation gap.
router.get('/', async (req, res) => {
  try {
    const sentForSettleRows = getPaymentAccountingSentForSettle();
    const allAccounting = getAccountingAll();

    // The PSP Reference in Payment Accounting and BP Accounting are generated independently
    // in the mock data and don't share the same value. Merchant Reference is the consistent
    // join key across both reports (it's set by the merchant and appears in both).
    const capturedByMerchantRef = new Map();
    for (const r of allAccounting) {
      if (r.category === 'platformPayment' && r.status === 'captured' && r.merchantRef) {
        capturedByMerchantRef.set(r.merchantRef, r);
      }
    }

    const matched = [];
    const unmatched = [];

    for (const sfs of sentForSettleRows) {
      const bpRow = capturedByMerchantRef.get(sfs.merchantReference);
      if (bpRow) {
        matched.push({
          pspRef: sfs.pspReference,
          merchantRef: sfs.merchantReference,
          bookingDate: sfs.bookingDate,
          amount: sfs.mainAmount,
          statusInPaymentAccounting: sfs.recordType,
          statusInBPAccounting: bpRow.status,
          accountHolder: bpRow.accountHolder,
          merchantName: MERCHANT_NAMES[bpRow.accountHolder] || bpRow.accountHolder,
          bpPspRef: bpRow.pspRef,
        });
      } else {
        unmatched.push({
          pspRef: sfs.pspReference,
          merchantRef: sfs.merchantReference,
          bookingDate: sfs.bookingDate,
          amount: sfs.mainAmount,
          merchantAccount: sfs.merchantAccount,
          reason: 'No captured row found in BP Accounting for this PSP Reference',
          rawPaymentAccountingRow: sfs,
        });
      }
    }

    res.json({
      matched,
      unmatched,
      summary: {
        total: sentForSettleRows.length,
        matched: matched.length,
        unmatched: unmatched.length,
      },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
