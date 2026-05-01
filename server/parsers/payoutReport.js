import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import logger from '../services/logger.js';

// Payout report dates use yyyy-MM-dd HH:mm:ss format
function parsePayoutDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim().replace(' ', 'T');
  // Append UTC marker if not already present
  return new Date(s.includes('T') ? s + '.000Z' : s).toISOString();
}

// Groups rows into payout batches keyed by AccountHolder + Payout Date.
// The bankTransfer row (type=bankTransfer, status=booked) is the disbursement;
// all other rows are the transactions that funded the batch.
export function parseBatches(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const batchMap = new Map();

    for (const row of rows) {
      if (Object.values(row).every(v => v === '')) continue;

      const accountHolder = row['AccountHolder']?.trim() || '';
      const balanceAccount = row['BalanceAccount']?.trim() || '';
      const payoutDateRaw = row['Payout Date']?.trim() || '';
      const payoutDate = parsePayoutDate(payoutDateRaw);
      // Batch key = accountHolder + payoutDate (the date part only)
      const dateKey = payoutDateRaw.split(' ')[0];
      const batchKey = `${accountHolder}::${dateKey}`;

      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, {
          accountHolder,
          balanceAccount,
          payoutDate,
          transactions: [],
          disbursement: null,
        });
      }

      const batch = batchMap.get(batchKey);
      const type = row['Type']?.trim() || '';
      const status = row['Status']?.trim() || '';
      const amount = Math.round((parseFloat(row['Balance (PC)']) || 0) * 100) / 100;

      const txn = {
        transferId: row['Transfer Id']?.trim() || '',
        txnId: row['Transaction Id']?.trim() || '',
        merchantRef: row['Psp Payment Merchant Reference']?.trim() || '',
        pspRef: row['Psp Payment Psp Reference']?.trim() || '',
        type,
        status,
        amount,
        rollingBalance: Math.round((parseFloat(row['Rolling Balance']) || 0) * 100) / 100,
        bookingDate: parsePayoutDate(row['Booking date']),
        valueDate: parsePayoutDate(row['Value date']),
      };

      // The bankTransfer + booked row is the actual disbursement to the merchant's bank
      if (type === 'bankTransfer' && status === 'booked') {
        batch.disbursement = {
          transferId: txn.transferId,
          amount: txn.amount,
          bookedAt: txn.bookingDate,
        };
      } else {
        batch.transactions.push(txn);
      }
    }

    return Array.from(batchMap.values());
  } catch (err) {
    logger.error(`payoutReport.parseBatches failed for ${filePath}: ${err.message}`);
    return [];
  }
}
