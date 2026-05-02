import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import logger from '../services/logger.js';

// Payment Accounting Report dates use yyyy-MM-dd HH:mm:ss format
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  return new Date(dateStr.trim().replace(' ', 'T') + '.000Z').toISOString();
}

function parseFloat2(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function mapRow(row) {
  return {
    companyAccount: row['Company Account']?.trim() || '',
    merchantAccount: row['Merchant Account']?.trim() || '',
    pspReference: row['Psp Reference']?.trim() || '',
    merchantReference: row['Merchant Reference']?.trim() || '',
    paymentMethod: row['Payment Method']?.trim() || '',
    bookingDate: parseDate(row['Booking Date']),
    mainCurrency: row['Main Currency']?.trim() || '',
    mainAmount: parseFloat2(row['Main Amount']),
    recordType: row['Record Type']?.trim() || '',
    paymentCurrency: row['Payment Currency']?.trim() || '',
    receivedPC: parseFloat2(row['Received (PC)']),
    authorisedPC: parseFloat2(row['Authorised (PC)']),
    capturedPC: parseFloat2(row['Captured (PC)']),
    settlementCurrency: row['Settlement Currency']?.trim() || '',
    payableSC: parseFloat2(row['Payable (SC)']),
    commissionSC: parseFloat2(row['Commission (SC)']),
    markupSC: parseFloat2(row['Markup (SC)']),
    schemeFeesSC: parseFloat2(row['Scheme Fees (SC)']),
    interchangeSC: parseFloat2(row['Interchange (SC)']),
    processingFeeCurrency: row['Processing Fee Currency']?.trim() || '',
    processingFeeFC: parseFloat2(row['Processing Fee (FC)']),
    userName: row['User Name']?.trim() || '',
    modificationMerchantReference: row['Modification Merchant Reference']?.trim() || '',
  };
}

export function parseAll(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    return rows
      .filter(row => Object.values(row).some(v => v !== ''))
      .map(mapRow);
  } catch (err) {
    logger.error(`paymentAccountingReport.parseAll failed for ${filePath}: ${err.message}`);
    return [];
  }
}

// SentForSettle rows are the trigger point for BP Accounting bookings.
// These are the anchor rows for the payments reconciliation join.
export function parseBySentForSettle(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    return rows
      .filter(row => row['Record Type']?.trim() === 'SentForSettle')
      .map(mapRow);
  } catch (err) {
    logger.error(`paymentAccountingReport.parseBySentForSettle failed for ${filePath}: ${err.message}`);
    return [];
  }
}

// Settled rows have fee columns populated: Interchange, Scheme Fees, Markup, Commission.
export function parseSettled(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    return rows
      .filter(row => row['Record Type']?.trim() === 'Settled')
      .map(mapRow);
  } catch (err) {
    logger.error(`paymentAccountingReport.parseSettled failed for ${filePath}: ${err.message}`);
    return [];
  }
}
