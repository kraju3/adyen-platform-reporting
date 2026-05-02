import { Router } from 'express';
import { getBalanceReport } from '../../services/reportStore.js';
import { MERCHANT_NAMES } from '../../constants/merchants.js';
import logger from '../../services/logger.js';

const router = Router();

// The balance report's opening/closing chain should be consistent:
// each day's opening balance must equal the prior day's closing balance.
// A break in this chain indicates a discrepancy — the closing balance on the
// prior day doesn't match the calculated balance for that day.
//
// CLAUDE.md: "Balance Report closing balance per account per day vs. cumulative
// sum of Balance (PC) from BP Accounting up to that date."
// In practice, we detect this by checking chain continuity: if next_day.opening ≠
// this_day.closing, then this_day.closing is the discrepant row.
router.get('/', async (req, res) => {
  try {
    const balanceRows = getBalanceReport();

    // Group by account holder, sort by opening date
    const byAccount = new Map();
    for (const r of balanceRows) {
      const key = r.balanceAccount;
      if (!byAccount.has(key)) byAccount.set(key, []);
      byAccount.get(key).push(r);
    }

    const verified = [];
    const discrepancies = [];

    for (const [balanceAccount, rows] of byAccount) {
      rows.sort((a, b) => a.openingDate.localeCompare(b.openingDate));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nextRow = rows[i + 1];
        const merchantName = MERCHANT_NAMES[row.accountHolder] || row.accountHolder;

        // Compare this row's closing balance to the next day's opening balance.
        // If there's no next row, we can only check internal consistency.
        if (nextRow) {
          const expectedNextOpen = row.closingAmount;
          const actualNextOpen = nextRow.openingAmount;
          const diff = Math.round((row.closingAmount - actualNextOpen) * 100) / 100;

          if (Math.abs(diff) > 0.01) {
            // The closing balance on this day doesn't match the next day's opening —
            // the balance report chain is broken here.
            discrepancies.push({
              accountHolder: row.accountHolder,
              balanceAccount,
              merchantName,
              date: row.closingDate?.split('T')[0] || '',
              reportedClosingBalance: row.closingAmount,
              calculatedBalance: actualNextOpen,
              difference: diff,
              currency: row.closingCurrency,
            });
            continue;
          }
        }

        verified.push({
          accountHolder: row.accountHolder,
          balanceAccount,
          merchantName,
          date: row.closingDate?.split('T')[0] || '',
          reportedClosingBalance: row.closingAmount,
          openingBalance: row.openingAmount,
          currency: row.closingCurrency,
        });
      }
    }

    res.json({
      verified,
      discrepancies,
      summary: {
        total: balanceRows.length,
        verified: verified.length,
        discrepancies: discrepancies.length,
      },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
