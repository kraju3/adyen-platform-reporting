import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import logger from '../services/logger.js';

// Accounting report dates use dd/MM/yyyy HH:mm format (EST timezone)
// We store as UTC ISO strings — timezone offset is consistent across all data
function parseAccountingDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();
  const [datePart, timePart = '00:00'] = s.split(' ');
  const [dd, mm, yyyy] = datePart.split('/');
  return new Date(`${yyyy}-${mm}-${dd}T${timePart}:00.000Z`).toISOString();
}

function mapRow(row) {
  return {
    transferId: row['Transfer Id']?.trim() || '',
    txnId: row['Transaction Id']?.trim() || '',
    accountHolder: row['AccountHolder']?.trim() || '',
    balanceAccount: row['BalanceAccount']?.trim() || '',
    category: row['Category']?.trim() || '',
    status: row['Status']?.trim() || '',
    type: row['Type']?.trim() || '',
    bookingDate: parseAccountingDate(row['Booking Date']),
    valueDate: parseAccountingDate(row['Value Date']),
    currency: row['Currency']?.trim() || 'USD',
    amount: Math.round((parseFloat(row['Amount']) || 0) * 100) / 100,
    merchantRef: row['Psp Payment Merchant Reference']?.trim() || '',
    pspRef: row['Psp Payment Psp Reference']?.trim() || '',
    counterpartyBalanceAccount: row['Counterparty Balance Account Id']?.trim() || '',
    description: row['Description']?.trim() || '',
  };
}

export function parseAll(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return rows
      .filter(row => Object.values(row).some(v => v !== ''))
      .map(mapRow);
  } catch (err) {
    logger.error(`accountingReport.parseAll failed for ${filePath}: ${err.message}`);
    return [];
  }
}

// Final-status rows are those with a non-empty Transaction Id —
// received and authorised lifecycle rows never have a Transaction Id populated.
// Deduplication key = Transfer Id to ensure exactly one row per transaction.
export function parseFinalStatus(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const seen = new Set();
    const result = [];
    for (const row of rows) {
      if (Object.values(row).every(v => v === '')) continue;
      const txnId = row['Transaction Id']?.trim();
      if (!txnId) continue; // not a final-status row
      const transferId = row['Transfer Id']?.trim();
      if (seen.has(transferId)) continue;
      seen.add(transferId);
      result.push(mapRow(row));
    }
    return result;
  } catch (err) {
    logger.error(`accountingReport.parseFinalStatus failed for ${filePath}: ${err.message}`);
    return [];
  }
}
