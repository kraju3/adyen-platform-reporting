import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseAll, parseFinalStatus } from '../parsers/accountingReport.js';
import { parseBatches } from '../parsers/payoutReport.js';
import { parseFees } from '../parsers/feeReport.js';
import { parseStatement } from '../parsers/statementReport.js';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '../mock/reports');

// All reports are loaded synchronously at module import time so routes never
// need to wait for I/O after startup. The parsed data is immutable for the
// lifetime of the process.

const ACCOUNTING_ALL = parseAll(join(REPORTS_DIR, 'balanceplatform_accounting_report_2024_07.csv'));
const ACCOUNTING_FINAL = parseFinalStatus(join(REPORTS_DIR, 'balanceplatform_accounting_report_2024_07.csv'));
const PAYOUT_BATCHES = parseBatches(join(REPORTS_DIR, 'balanceplatform_payout_report_2024_07.csv'));
const FEES = parseFees(join(REPORTS_DIR, 'balanceplatform_fee_report_2024_07.csv'));
const STATEMENTS = parseStatement(join(REPORTS_DIR, 'balance_platform_statement_report_2024_07.csv'));

logger.info(`Accounting Report: ${ACCOUNTING_ALL.length.toLocaleString()} rows (${ACCOUNTING_FINAL.length.toLocaleString()} final-status transactions)`);
logger.info(`Payout Report: ${(PAYOUT_BATCHES.reduce((n, b) => n + b.transactions.length + (b.disbursement ? 1 : 0), 0)).toLocaleString()} rows (${PAYOUT_BATCHES.length.toLocaleString()} payout batches)`);
logger.info(`Fee Report: ${FEES.rows.length.toLocaleString()} rows`);
logger.info(`Statement Report: ${STATEMENTS.reduce((n, s) => n + s.transactions.length + 2, 0).toLocaleString()} rows (${STATEMENTS.length.toLocaleString()} merchants)`);

export const getAccountingAll = () => ACCOUNTING_ALL;
export const getAccountingFinal = () => ACCOUNTING_FINAL;
export const getPayoutBatches = () => PAYOUT_BATCHES;
export const getFees = () => FEES;
export const getStatements = () => STATEMENTS;
