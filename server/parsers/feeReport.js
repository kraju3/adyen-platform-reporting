import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import logger from '../services/logger.js';

// Summary is pre-computed once at parse time to avoid recomputation per request.
export function parseFees(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rawRows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const rows = rawRows
      .filter(row => Object.values(row).some(v => v !== ''))
      .map(row => ({
        billingMonth: row['Billing Month']?.trim() || '',
        accountHolder: row['AccountHolder']?.trim() || '',
        balanceAccount: row['BalanceAccount']?.trim() || '',
        feeType: row['Fee Type']?.trim() || '',
        feeName: row['Fee Name']?.trim() || '',
        currency: row['Currency']?.trim() || 'USD',
        amount: Math.round((parseFloat(row['Fee Amount']) || 0) * 100) / 100,
      }));

    const summary = computeSummary(rows);

    return { rows, summary };
  } catch (err) {
    logger.error(`feeReport.parseFees failed for ${filePath}: ${err.message}`);
    return { rows: [], summary: { byType: {}, total: 0 } };
  }
}

export function computeSummary(rows) {
  const byType = {};
  let total = 0;
  for (const row of rows) {
    byType[row.feeType] = Math.round(((byType[row.feeType] || 0) + row.amount) * 100) / 100;
    total = Math.round((total + row.amount) * 100) / 100;
  }
  return { byType, total };
}
