import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import logger from '../services/logger.js';

// Balance report dates use yyyy-MM-dd HH:mm:ss format
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  return new Date(dateStr.trim().replace(' ', 'T') + '.000Z').toISOString();
}

// Returns one row per BalanceAccount per currency per day.
// Each row is a daily snapshot: opening balance at start of day, closing at end.
export function parseBalances(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    return rows
      .filter(row => Object.values(row).some(v => v !== ''))
      .map(row => ({
        balancePlatform: row['Balance Platform']?.trim() || '',
        accountHolder: row['Account Holder']?.trim() || '',
        balanceAccount: row['Balance Account']?.trim() || '',
        openingCurrency: row['Opening Balance Currency']?.trim() || '',
        openingAmount: Math.round((parseFloat(row['Opening Balance Amount']) || 0) * 100) / 100,
        openingDate: parseDate(row['Opening Date']),
        closingCurrency: row['Closing Balance Currency']?.trim() || '',
        closingAmount: Math.round((parseFloat(row['Closing Balance Amount']) || 0) * 100) / 100,
        closingDate: parseDate(row['Closing Date']),
      }));
  } catch (err) {
    logger.error(`balanceReport.parseBalances failed for ${filePath}: ${err.message}`);
    return [];
  }
}
