import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseAll, parseFinalStatus } from '../parsers/accountingReport.js';
import { parseBatches } from '../parsers/payoutReport.js';
import { parseFees } from '../parsers/feeReport.js';
import { parseStatement } from '../parsers/statementReport.js';
import { parseAll as parsePaymentAccounting, parseBySentForSettle, parseSettled } from '../parsers/paymentAccountingReport.js';
import { parseBalances } from '../parsers/balanceReport.js';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '../mock/reports');

// All reports are loaded synchronously at module import time so routes never
// need to wait for I/O after startup. The parsed data is immutable for the
// lifetime of the process.

const PAYMENT_ACCOUNTING_PATH = join(REPORTS_DIR, 'payment_accounting_report_2024_07.csv');
const BALANCE_REPORT_PATH = join(REPORTS_DIR, 'balanceplatform_balance_report_2024_07.csv');

const ACCOUNTING_ALL = parseAll(join(REPORTS_DIR, 'balanceplatform_accounting_report_2024_07.csv'));
const ACCOUNTING_FINAL = parseFinalStatus(join(REPORTS_DIR, 'balanceplatform_accounting_report_2024_07.csv'));
const PAYOUT_BATCHES = parseBatches(join(REPORTS_DIR, 'balanceplatform_payout_report_2024_07.csv'));
const FEES = parseFees(join(REPORTS_DIR, 'balanceplatform_fee_report_2024_07.csv'));
const STATEMENTS = parseStatement(join(REPORTS_DIR, 'balance_platform_statement_report_2024_07.csv'));

const PAYMENT_ACCOUNTING_ALL = parsePaymentAccounting(PAYMENT_ACCOUNTING_PATH);
const PAYMENT_ACCOUNTING_SENT_FOR_SETTLE = parseBySentForSettle(PAYMENT_ACCOUNTING_PATH);
const PAYMENT_ACCOUNTING_SETTLED = parseSettled(PAYMENT_ACCOUNTING_PATH);
const BALANCE_REPORT = parseBalances(BALANCE_REPORT_PATH);

logger.info(`Accounting Report: ${ACCOUNTING_ALL.length.toLocaleString()} rows (${ACCOUNTING_FINAL.length.toLocaleString()} final-status transactions)`);
logger.info(`Payout Report: ${(PAYOUT_BATCHES.reduce((n, b) => n + b.transactions.length + (b.disbursement ? 1 : 0), 0)).toLocaleString()} rows (${PAYOUT_BATCHES.length.toLocaleString()} payout batches)`);
logger.info(`Fee Report: ${FEES.rows.length.toLocaleString()} rows`);
logger.info(`Statement Report: ${STATEMENTS.reduce((n, s) => n + s.transactions.length + 2, 0).toLocaleString()} rows (${STATEMENTS.length.toLocaleString()} merchants)`);
logger.info(`Payment Accounting Report: ${PAYMENT_ACCOUNTING_ALL.length.toLocaleString()} rows (${PAYMENT_ACCOUNTING_SENT_FOR_SETTLE.length.toLocaleString()} SentForSettle, ${PAYMENT_ACCOUNTING_SETTLED.length.toLocaleString()} Settled)`);
logger.info(`Balance Report: ${BALANCE_REPORT.length.toLocaleString()} rows`);

export const getAccountingAll = () => ACCOUNTING_ALL;
export const getAccountingFinal = () => ACCOUNTING_FINAL;
export const getPayoutBatches = () => PAYOUT_BATCHES;
export const getFees = () => FEES;
export const getStatements = () => STATEMENTS;
export const getPaymentAccountingAll = () => PAYMENT_ACCOUNTING_ALL;
export const getPaymentAccountingSentForSettle = () => PAYMENT_ACCOUNTING_SENT_FOR_SETTLE;
export const getPaymentAccountingSettled = () => PAYMENT_ACCOUNTING_SETTLED;
export const getBalanceReport = () => BALANCE_REPORT;
