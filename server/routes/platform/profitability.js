import { Router } from 'express';
import { getAccountingAll, getFees } from '../../services/reportStore.js';
import { LIABLE_BALANCE_ACCOUNT } from '../../constants/merchants.js';
import logger from '../../services/logger.js';

const router = Router();

// Returns ISO week number for a given date
function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Returns the Monday of the week for a given date (ISO week start)
function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7; // treat Sunday as 7
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

router.get('/', async (req, res) => {
  try {
    // Liable account entries hold all commission credits and cost debits
    const liableEntries = getAccountingAll().filter(
      r => r.balanceAccount === LIABLE_BALANCE_ACCOUNT
    );

    // Commission = sum of positive fee entries on the liable account
    // (credits from sub-merchant commission transfers)
    const commissionEntries = liableEntries.filter(
      r => r.category === 'internal' && r.type === 'fee' && r.amount > 0
    );

    // Total Adyen fees billed to the platform this month
    const { summary: feeSummary } = getFees();

    let totalCommission = 0;
    for (const r of commissionEntries) {
      totalCommission = Math.round((totalCommission + r.amount) * 100) / 100;
    }

    const totalFees = feeSummary.total;
    const netProfit = Math.round((totalCommission - totalFees) * 100) / 100;
    const marginPercent = totalCommission > 0
      ? Math.round((netProfit / totalCommission) * 10000) / 100
      : 0;

    // Group liable account fee entries by ISO week for the trend chart
    const weekMap = new Map();
    for (const r of liableEntries) {
      if (!r.bookingDate) continue;
      const wk = weekStart(r.bookingDate);
      if (!weekMap.has(wk)) weekMap.set(wk, { weekStart: wk, commission: 0, fees: 0, profit: 0 });
      const entry = weekMap.get(wk);
      if (r.category === 'internal' && r.type === 'fee') {
        if (r.amount > 0) {
          entry.commission = Math.round((entry.commission + r.amount) * 100) / 100;
        } else {
          entry.fees = Math.round((entry.fees + Math.abs(r.amount)) * 100) / 100;
        }
      }
    }
    const byWeek = Array.from(weekMap.values())
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map(w => ({
        ...w,
        profit: Math.round((w.commission - w.fees) * 100) / 100,
      }));

    // Liable account balance summary
    let totalCredits = 0;
    let totalDebits = 0;
    for (const r of liableEntries) {
      if (r.amount > 0) totalCredits = Math.round((totalCredits + r.amount) * 100) / 100;
      else totalDebits = Math.round((totalDebits + Math.abs(r.amount)) * 100) / 100;
    }

    // Determine period from data
    const dates = liableEntries
      .map(r => r.bookingDate)
      .filter(Boolean)
      .sort();

    res.json({
      period: {
        start: dates[0]?.split('T')[0] || null,
        end: dates[dates.length - 1]?.split('T')[0] || null,
      },
      totalCommission,
      totalFees,
      netProfit,
      marginPercent,
      byWeek,
      liableAccountSummary: {
        totalCredits,
        totalDebits,
        closingBalance: Math.round((totalCredits - totalDebits) * 100) / 100,
      },
    });
  } catch (err) {
    logger.error(`Route error: ${err.message}`);
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  }
});

export default router;
