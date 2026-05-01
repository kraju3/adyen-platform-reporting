import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import logger from '../services/logger.js';

// Statement report dates use dd/MM/yyyy HH:mm format
function parseStatementDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();
  const [datePart, timePart = '00:00'] = s.split(' ');
  const [dd, mm, yyyy] = datePart.split('/');
  return new Date(`${yyyy}-${mm}-${dd}T${timePart}:00.000Z`).toISOString();
}

// Sentinel rows have an empty Category — they delimit each AccountHolder section.
// First sentinel = opening balance (read from Amount column).
// Last sentinel = closing balance (read from Ending Balance column,
// or Starting Balance if Ending Balance is not populated in this report variant).
export function parseStatement(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const accountMap = new Map();

    for (const row of rows) {
      if (Object.values(row).every(v => v === '')) continue;

      const accountHolder = row['AccountHolder']?.trim() || '';
      const balanceAccount = row['BalanceAccount']?.trim() || '';
      const category = row['Category']?.trim();

      if (!accountMap.has(accountHolder)) {
        accountMap.set(accountHolder, {
          accountHolder,
          balanceAccount,
          openingBalance: 0,
          closingBalance: 0,
          transactions: [],
          _sentinelCount: 0,
        });
      }

      const entry = accountMap.get(accountHolder);
      const isSentinel = !category;

      if (isSentinel) {
        entry._sentinelCount++;
        if (entry._sentinelCount === 1) {
          // Opening sentinel: balance is in the Amount column
          entry.openingBalance = Math.round((parseFloat(row['Amount']) || 0) * 100) / 100;
        } else {
          // Closing sentinel: balance is in Ending Balance or Starting Balance column
          const endingBal = parseFloat(row['Ending Balance']);
          const startingBal = parseFloat(row['Starting Balance']);
          entry.closingBalance = Math.round(
            ((!isNaN(endingBal) && endingBal !== 0 ? endingBal : startingBal) || 0) * 100
          ) / 100;
        }
        continue; // sentinel rows are not included in transactions
      }

      entry.transactions.push({
        transferId: row['Transfer Id']?.trim() || '',
        txnId: row['Transaction Id']?.trim() || '',
        category,
        type: row['Type']?.trim() || '',
        status: row['Status']?.trim() || '',
        merchantRef: row['Psp Payment Merchant Reference']?.trim() || '',
        pspRef: row['Psp Payment Psp Reference']?.trim() || '',
        bookingDate: parseStatementDate(row['Booking Date']),
        valueDate: parseStatementDate(row['Value Date']),
        currency: row['Currency']?.trim() || 'USD',
        amount: Math.round((parseFloat(row['Amount']) || 0) * 100) / 100,
      });
    }

    // Remove internal sentinel counter before returning
    return Array.from(accountMap.values()).map(({ _sentinelCount, ...rest }) => rest);
  } catch (err) {
    logger.error(`statementReport.parseStatement failed for ${filePath}: ${err.message}`);
    return [];
  }
}
