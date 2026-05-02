#!/usr/bin/env node
/**
 * Adyen Platform Mock Data Generator
 * Generates 4 linked CSV reports for July 2024
 *
 * Output files:
 *   balanceplatform_accounting_report_2024_07.csv
 *   balanceplatform_payout_report_2024_07.csv
 *   balanceplatform_fee_report_2024_07.csv
 *   balance_platform_statement_report_2024_07.csv
 *
 * Cross-report linkage:
 *   Transfer Id    → Accounting Report ↔ Payout Report (same ID in both)
 *   AccountHolder  → All 4 reports (identical strings)
 *   BalanceAccount → All 4 reports (identical strings)
 *   Value Date     → Accounting Report captured row = T+2 = Payout Date in Payout Report
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ────────────────────────────────────────────────────────────

const BALANCE_PLATFORM = 'DemoBalancePlatform';
const CURRENCY = 'USD';
const TIMEZONE = 'EST';
const COMMISSION_RATE = 0.025;  // 2.5% platform commission on each capture
const PAYOUT_DELAY_DAYS = 2;    // T+2 settlement — Value Date = Booking Date + 2

// ─── Merchant Roster ─────────────────────────────────────────────────────────
//
// These IDs are the canonical shared identifiers across all 4 reports.
// If any ID here changes, it breaks the cross-report joins.
//
const MERCHANTS = [
  {
    ah: 'AH3000000000000000000001',
    ba: 'BA3000000000000000000001',
    ahRef: 'BELLA-ITALIA-001',
    ahDesc: 'Bella Italia Restaurant',
    baRef: 'BA-BELLA-001',
    baDesc: 'Bella Italia - Main Account',
    avgTxn: 45,
    txnPerDay: 30,     // High-volume restaurant
    refundRate: 0.03,
    cbRate: 0.002,
    mcc: '5812',
  },
  {
    ah: 'AH3000000000000000000002',
    ba: 'BA3000000000000000000002',
    ahRef: 'TECH-GADGETS-001',
    ahDesc: 'Tech Gadgets Store',
    baRef: 'BA-TECH-001',
    baDesc: 'Tech Gadgets - Main Account',
    avgTxn: 120,
    txnPerDay: 14,     // Lower volume, higher ticket
    refundRate: 0.06,  // Higher refund rate — electronics
    cbRate: 0.008,
    mcc: '5734',
  },
  {
    ah: 'AH3000000000000000000003',
    ba: 'BA3000000000000000000003',
    ahRef: 'URBAN-FITNESS-001',
    ahDesc: 'Urban Fitness Studio',
    baRef: 'BA-FITNESS-001',
    baDesc: 'Urban Fitness - Main Account',
    avgTxn: 65,
    txnPerDay: 8,
    refundRate: 0.04,
    cbRate: 0.004,
    mcc: '7997',
  },
  {
    ah: 'AH3000000000000000000004',
    ba: 'BA3000000000000000000004',
    ahRef: 'GREEN-GARDEN-001',
    ahDesc: 'Green Garden Cafe',
    baRef: 'BA-GARDEN-001',
    baDesc: 'Green Garden - Main Account',
    avgTxn: 22,
    txnPerDay: 55,     // Very high volume, low ticket
    refundRate: 0.02,
    cbRate: 0.001,
    mcc: '5812',
  },
  {
    ah: 'AH3000000000000000000005',
    ba: 'BA3000000000000000000005',
    ahRef: 'SWIFT-DELIVERY-001',
    ahDesc: 'Swift Delivery Co',
    baRef: 'BA-SWIFT-001',
    baDesc: 'Swift Delivery - Main Account',
    avgTxn: 18,
    txnPerDay: 70,
    refundRate: 0.05,
    cbRate: 0.015,     // Higher CB rate — will trigger negative balance scenario
    mcc: '7399',
  },
];

// Liable account — platform's own balance account.
// Commission from each sub-merchant capture lands here.
const LIABLE = {
  ah:     'AH3000000000000000000000',
  ba:     'BA3000000000000000000000',
  ahRef:  'PLATFORM-LIABLE',
  ahDesc: 'Demo Platform - Liable Account',
  baRef:  'BA-PLATFORM-LIABLE',
  baDesc: 'Platform Liable Account',
};

// ─── ID Generators ────────────────────────────────────────────────────────────
//
// IDs follow Adyen's style: 16 uppercase alphanumeric characters.
// A sequential seed ensures uniqueness; shuffle adds visual randomness.

let _seq = 100000;

function nextId() {
  const n = (_seq++).toString(36).toUpperCase().padStart(6, '0');
  const suffix = Math.random().toString(36).toUpperCase().replace('.', '').slice(0, 10);
  return (n + suffix).slice(0, 16).padEnd(16, '0');
}

const genTransferId = nextId;
const genPspRef     = () => 'P' + nextId().slice(1);
const genTxnId      = () => 'T' + nextId().slice(1);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand(min, max) { return Math.random() * (max - min) + min; }
function round2(n)       { return Math.round(n * 100) / 100; }
function addDays(d, n)   { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

// Accounting report date format: dd/MM/yyyy HH:mm
function fmtDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Payout report date format: yyyy-MM-dd HH:mm:ss
function fmtDateISO(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function toCsv(rows) {
  return rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  ).join('\n');
}

// ─── Step 1: Generate raw transactions ───────────────────────────────────────
//
// Each transaction is an object with all the fields needed to write rows
// into multiple reports. The Transfer Id is generated once here and reused
// in both the Accounting Report and the Payout Report.

function generateTransactions() {
  const txns = [];

  for (const merchant of MERCHANTS) {
    for (let day = 1; day <= 31; day++) {
      const base = new Date(`2024-07-${String(day).padStart(2, '0')}T00:00:00Z`);
      if (base.getMonth() !== 6) continue; // Guard: July only

      const count = Math.round(merchant.txnPerDay * rand(0.75, 1.25));

      for (let i = 0; i < count; i++) {
        const bookingDate = new Date(base);
        bookingDate.setHours(Math.floor(rand(8, 22)), Math.floor(rand(0, 59)), 0, 0);

        const valueDate = addDays(bookingDate, PAYOUT_DELAY_DAYS);
        valueDate.setHours(0, 0, 0, 0); // Value dates are always midnight

        const amount    = round2(merchant.avgTxn * rand(0.4, 2.2));
        const merchantRef = `${merchant.ahRef}-ORD-${String(day).padStart(2,'0')}-${String(i+1).padStart(3,'0')}`;

        const capture = {
          merchant,
          transferId:  genTransferId(),  // ← used in Accounting + Payout reports
          pspRef:      genPspRef(),       // ← used in Accounting report, joins to Fee Report
          txnId:       genTxnId(),
          bookingDate,
          valueDate,
          amount,
          type:        'capture',
          status:      'captured',
          merchantRef,
        };
        txns.push(capture);

        // Refund: references original transfer/psp for traceability
        if (Math.random() < merchant.refundRate) {
          const rd = addDays(bookingDate, Math.ceil(rand(1, 6)));
          if (rd.getMonth() === 6) {
            txns.push({
              merchant,
              transferId:  genTransferId(),
              pspRef:      genPspRef(),
              txnId:       genTxnId(),
              bookingDate: rd,
              valueDate:   addDays(rd, PAYOUT_DELAY_DAYS),
              amount:      -amount,
              type:        'refund',
              status:      'refunded',
              merchantRef: `${merchantRef}-REF`,
              originalTransferId: capture.transferId,
              originalPspRef:     capture.pspRef,
            });
          }
        }

        // Chargeback — arrives 5–25 days later
        if (Math.random() < merchant.cbRate) {
          const cd = addDays(bookingDate, Math.ceil(rand(5, 25)));
          if (cd.getMonth() === 6) {
            const cbTransferId = genTransferId();
            txns.push({
              merchant,
              transferId:  cbTransferId,
              pspRef:      genPspRef(),
              txnId:       genTxnId(),
              bookingDate: cd,
              valueDate:   cd,
              amount:      -amount,
              type:        'chargeback',
              status:      'chargeback',
              merchantRef: `${merchantRef}-CB`,
              originalPspRef: capture.pspRef,
              isChargeback: true,
            });

            // ~40% of chargebacks get reversed (won by merchant)
            if (Math.random() < 0.4) {
              const revDate = addDays(cd, Math.ceil(rand(3, 10)));
              if (revDate.getMonth() === 6) {
                txns.push({
                  merchant,
                  transferId:  cbTransferId, // same Transfer Id — it's the same dispute event
                  pspRef:      genPspRef(),
                  txnId:       genTxnId(),
                  bookingDate: revDate,
                  valueDate:   revDate,
                  amount:      round2(amount * 0.975), // small scheme fee withheld
                  type:        'chargebackReversal',
                  status:      'chargebackReversed',
                  merchantRef: `${merchantRef}-CB-REV`,
                });
              }
            }
          }
        }
      }
    }
  }

  // Sort all transactions by booking date for natural ordering in reports
  return txns.sort((a, b) => a.bookingDate - b.bookingDate);
}

// ─── Report 1: Balance Platform Accounting Report ────────────────────────────
//
// Each transaction produces 3 rows: received → authorised → final status.
// This represents the lifecycle of funds through reserved/received/balance buckets.
//
// Column layout (55 columns — must match exactly):
//   0  BalancePlatform          19 Balance (PC)
//   1  AccountHolder            20 Reference
//   2  BalanceAccount           21 Description
//   3  Transfer Id              22 Counterparty Balance Account Id
//   4  Transaction Id           23 Psp Payment Merchant Reference
//   5  Category                 24 Psp Payment Psp Reference
//   6  Status                   25 Psp Modification Psp Reference
//   7  Type                     26 Psp Modification Merchant Reference
//   8  Booking Date             27 Payment Instrument Type
//   9  Booking Date TimeZone    28 Payment Instrument Id
//  10  Value Date               29 Entrymode
//  11  Value Date TimeZone      30 Auth Code
//  12  Currency                 31 Shopper Interaction
//  13  Amount                   32 MCC
//  14  Original Currency        33–44 Counterparty/Interchange fields
//  15  Original Amount          45–54 Reserved1–Reserved10
//  16  Payment Currency
//  17  Received (PC)
//  18  Reserved (PC)

function buildAccountingReport(txns) {
  const COLS = [
    'BalancePlatform','AccountHolder','BalanceAccount','Transfer Id','Transaction Id',
    'Category','Status','Type','Booking Date','Booking Date TimeZone','Value Date',
    'Value Date TimeZone','Currency','Amount','Original Currency','Original Amount',
    'Payment Currency','Received (PC)','Reserved (PC)','Balance (PC)',
    'Reference','Description','Counterparty Balance Account Id',
    'Psp Payment Merchant Reference','Psp Payment Psp Reference',
    'Psp Modification Psp Reference','Psp Modification Merchant Reference',
    'Payment Instrument Type','Payment Instrument Id','Entrymode','Auth Code',
    'Shopper Interaction','MCC','Counterparty Name','Counterparty Address',
    'Counterparty City','Counterparty Country','Counterparty iban','Counterparty bic',
    'Counterparty Account Number','Counterparty Postal Code','Interchange Currency',
    'Interchange','Beneficiary Balance Account','Reference for Beneficiary',
    'Reserved1','Reserved2','Reserved3','Reserved4','Reserved5',
    'Reserved6','Reserved7','Reserved8','Reserved9','Reserved10',
  ];

  const rows = [COLS];

  // Track running balance per BalanceAccount
  const balances = {};
  const bal = ba => balances[ba] ?? 0;
  const setBal = (ba, v) => { balances[ba] = round2(v); };

  function makeRow(fields) {
    // Build a 55-element array from a partial object, empty string for missing
    return COLS.map(col => fields[col] ?? '');
  }

  // Emit the 3-row lifecycle for a balance account movement
  function emitLifecycle(opts) {
    const {
      ah, ba, transferId, txnId, category, type, finalStatus,
      bookingDate, valueDate, currency, amount, reference, description,
      counterpartyBa, merchantRef, pspRef, modPspRef, modMerchantRef,
      instrType, entrymode, shopperInteraction, mcc,
    } = opts;

    const bd  = fmtDate(bookingDate);
    const vd  = valueDate ? fmtDate(valueDate) : '';
    const cur = currency || CURRENCY;
    const currentBalance = bal(ba);

    const shared = {
      'BalancePlatform':               BALANCE_PLATFORM,
      'AccountHolder':                 ah,
      'BalanceAccount':                ba,
      'Transfer Id':                   transferId,
      'Category':                      category,
      'Type':                          type,
      'Booking Date':                  bd,
      'Booking Date TimeZone':         TIMEZONE,
      'Currency':                      cur,
      'Amount':                        amount,
      'Payment Currency':              cur,
      'Reference':                     reference || '',
      'Description':                   description || '',
      'Counterparty Balance Account Id': counterpartyBa || '',
      'Psp Payment Merchant Reference':  merchantRef || '',
      'Psp Payment Psp Reference':       pspRef || '',
      'Psp Modification Psp Reference':  modPspRef || '',
      'Psp Modification Merchant Reference': modMerchantRef || '',
      'Payment Instrument Type':       instrType || 'card',
      'Entrymode':                     entrymode || 'Contactless',
      'Shopper Interaction':           shopperInteraction || 'Ecommerce',
      'MCC':                           mcc || '',
    };

    // Row 1: received — funds enter the received bucket
    rows.push(makeRow({ ...shared, 'Transaction Id': '', 'Status': 'received',
      'Value Date': '', 'Value Date TimeZone': '',
      'Received (PC)': amount, 'Reserved (PC)': 0, 'Balance (PC)': currentBalance }));

    // Row 2: authorised — funds move from received to reserved
    rows.push(makeRow({ ...shared, 'Transaction Id': '', 'Status': 'authorised',
      'Value Date': '', 'Value Date TimeZone': '',
      'Received (PC)': -amount, 'Reserved (PC)': amount, 'Balance (PC)': currentBalance }));

    // Row 3: final — funds settle into balance
    const newBalance = round2(currentBalance + amount);
    setBal(ba, newBalance);
    rows.push(makeRow({ ...shared, 'Transaction Id': txnId, 'Status': finalStatus,
      'Value Date': vd, 'Value Date TimeZone': vd ? TIMEZONE : '',
      'Received (PC)': 0, 'Reserved (PC)': -amount, 'Balance (PC)': newBalance }));

    return newBalance;
  }

  for (const txn of txns) {
    const { merchant } = txn;

    // Main transaction row (3 rows: received → authorised → final)
    emitLifecycle({
      ah:              merchant.ah,
      ba:              merchant.ba,
      transferId:      txn.transferId,
      txnId:           txn.txnId,
      category:        'platformPayment',
      type:            txn.type,
      finalStatus:     txn.status,
      bookingDate:     txn.bookingDate,
      valueDate:       txn.valueDate,
      amount:          txn.amount,
      reference:       txn.merchantRef,
      description:     `Order ${txn.merchantRef}`,
      merchantRef:     txn.merchantRef,
      pspRef:          txn.pspRef,
      mcc:             merchant.mcc,
    });

    // For each capture: also write a commission transfer (sub-merchant → liable account)
    if (txn.type === 'capture') {
      const commission = round2(txn.amount * COMMISSION_RATE);
      const feeTransferId = genTransferId();
      const desc = `Commission for ${txn.merchantRef}`;

      // Fee debited from sub-merchant balance account
      emitLifecycle({
        ah: merchant.ah, ba: merchant.ba,
        transferId: feeTransferId, txnId: genTxnId(),
        category: 'internal', type: 'fee', finalStatus: 'fee',
        bookingDate: txn.bookingDate, valueDate: txn.valueDate,
        amount: -commission,
        reference: txn.merchantRef, description: desc,
        counterpartyBa: LIABLE.ba,
        merchantRef: txn.merchantRef, pspRef: txn.pspRef,
        mcc: merchant.mcc,
      });

      // Commission credited to liable account
      emitLifecycle({
        ah: LIABLE.ah, ba: LIABLE.ba,
        transferId: feeTransferId, txnId: genTxnId(),
        category: 'internal', type: 'fee', finalStatus: 'fee',
        bookingDate: txn.bookingDate, valueDate: txn.valueDate,
        amount: commission,
        reference: txn.merchantRef, description: desc,
        counterpartyBa: merchant.ba,
        merchantRef: txn.merchantRef, pspRef: txn.pspRef,
        mcc: merchant.mcc,
      });
    }
  }

  return toCsv(rows);
}

// ─── Report 2: Payout Report ─────────────────────────────────────────────────
//
// Groups captured transactions by (merchant + payout date).
// Payout Date = Value Date of the captured row (T+2 from booking date).
// Each group ends with a bankTransfer row — the actual disbursement.
//
// The Transfer Id in each transaction row is the SAME Transfer Id from
// the Accounting Report — this is the key join between the two reports.

function buildPayoutReport(txns) {
  const COLS = [
    'BalancePlatform','AccountHolder','BalanceAccount',
    'AccountHolder Reference','AccountHolder Description',
    'BalanceAccount Reference','BalanceAccount Description',
    'Transfer Id','Transaction Id',
    'Booking date','Booking date TimeZone',
    'Value date','Value date TimeZone',
    'Category','Type','Status',
    'Currency','Balance (PC)','Rolling Balance',
    'Reference','Description',
    'Counterparty Balance Account Id',
    'Psp Payment Merchant Reference','Psp Payment Psp Reference',
    'Payout Date',
  ];

  const rows = [COLS];

  // Group: only captured transactions form payout batches
  // Key = merchantBA + payoutDate (ISO date string)
  const groups = new Map();

  for (const txn of txns) {
    if (txn.status !== 'captured') continue;
    const payoutKey = `${txn.merchant.ba}::${txn.valueDate.toISOString().slice(0, 10)}`;
    if (!groups.has(payoutKey)) {
      groups.set(payoutKey, { merchant: txn.merchant, payoutDate: txn.valueDate, txns: [] });
    }
    groups.get(payoutKey).txns.push(txn);
  }

  for (const { merchant, payoutDate, txns: batchTxns } of groups.values()) {
    let rolling = 0;

    // Set payout dispatch time to 07:00 on payout date
    const payoutDispatch = new Date(payoutDate);
    payoutDispatch.setHours(7, 0, 0, 0);
    const payoutDateStr = fmtDateISO(payoutDispatch);

    // Transaction rows — each uses the Transfer Id from the Accounting Report
    for (const txn of batchTxns) {
      rolling = round2(rolling + txn.amount);
      const txnFields = {
        'BalancePlatform':            BALANCE_PLATFORM,
        'AccountHolder':              merchant.ah,
        'BalanceAccount':             merchant.ba,
        'AccountHolder Reference':    merchant.ahRef,
        'AccountHolder Description':  merchant.ahDesc,
        'BalanceAccount Reference':   merchant.baRef,
        'BalanceAccount Description': merchant.baDesc,
        'Transfer Id':                txn.transferId,   // ← same ID as Accounting Report
        'Transaction Id':             txn.txnId,
        'Booking date':               fmtDateISO(txn.bookingDate),
        'Booking date TimeZone':      TIMEZONE,
        'Value date':                 fmtDateISO(txn.valueDate),
        'Value date TimeZone':        TIMEZONE,
        'Category':                   'platformPayment',
        'Type':                       txn.type,
        'Status':                     txn.status,
        'Currency':                   CURRENCY,
        'Balance (PC)':               txn.amount,
        'Rolling Balance':            rolling,
        'Reference':                  txn.merchantRef,
        'Description':                `Order ${txn.merchantRef}`,
        'Counterparty Balance Account Id': '',
        'Psp Payment Merchant Reference':  txn.merchantRef,
        'Psp Payment Psp Reference':       txn.pspRef,
        'Payout Date':                     payoutDateStr,
      };
      rows.push(COLS.map(col => txnFields[col] ?? ''));
    }

    // Final bankTransfer row — the actual payout disbursement to merchant's bank
    // Rolling balance goes to zero after payout
    const payoutAmount = -rolling; // Negative = outgoing from balance account
    const payoutFields = {
      'BalancePlatform':            BALANCE_PLATFORM,
      'AccountHolder':              merchant.ah,
      'BalanceAccount':             merchant.ba,
      'AccountHolder Reference':    merchant.ahRef,
      'AccountHolder Description':  merchant.ahDesc,
      'BalanceAccount Reference':   merchant.baRef,
      'BalanceAccount Description': merchant.baDesc,
      'Transfer Id':                genTransferId(),
      'Transaction Id':             genTxnId(),
      'Booking date':               fmtDateISO(payoutDispatch),
      'Booking date TimeZone':      TIMEZONE,
      'Value date':                 fmtDateISO(payoutDispatch),
      'Value date TimeZone':        TIMEZONE,
      'Category':                   'bank',
      'Type':                       'bankTransfer',
      'Status':                     'booked',
      'Currency':                   CURRENCY,
      'Balance (PC)':               payoutAmount,
      'Rolling Balance':            0,
      'Reference':                  `PAYOUT-${merchant.ahRef}-${payoutDate.toISOString().slice(0, 10)}`,
      'Description':                `Payout batch for ${merchant.ahDesc}`,
      'Counterparty Balance Account Id': '',
      'Psp Payment Merchant Reference':  '',
      'Psp Payment Psp Reference':       '',
      'Payout Date':                     payoutDateStr,
    };
    rows.push(COLS.map(col => payoutFields[col] ?? ''));
  }

  return toCsv(rows);
}

// ─── Report 3: Fee Report ─────────────────────────────────────────────────────
//
// Monthly aggregation — one row per AccountHolder per fee type per fee name.
// Fees are calculated from the transaction data so they're consistent with
// the Accounting Report amounts. AccountHolder IDs must match exactly.

function buildFeeReport(txns) {
  const COLS = ['Billing Month','BalancePlatform','AccountHolder','BalanceAccount','Fee Type','Fee Name','Currency','Fee Amount'];
  const rows = [COLS];

  const FEE_STRUCTURE = [
    // Payment Method Fees — on gross volume
    { type: 'Payment Method Fees', name: 'Interchange Issuing Bank',    basis: 'volume',    rate: 0.012  },
    { type: 'Payment Method Fees', name: 'Scheme Fees',                 basis: 'volume',    rate: 0.003  },
    { type: 'Payment Method Fees', name: 'Commission',                  basis: 'volume',    rate: 0.005  },
    { type: 'Payment Method Fees', name: 'Scheme Fees - Refused',       basis: 'volume',    rate: 0.0002 },
    { type: 'Payment Method Fees', name: 'Scheme Fees - Cancelled',     basis: 'volume',    rate: 0.0001 },
    { type: 'Payment Method Fees', name: 'Scheme Fees - RetryOnRefused',basis: 'volume',    rate: 0.0001 },
    // Processing Fees — flat per transaction
    { type: 'Processing Fees',     name: 'Transaction fee',             basis: 'per_txn',   flat: 0.10   },
    // Refund Fees — on refund volume
    { type: 'Refund Fees',         name: 'Interchange Issuing Bank - Refund', basis: 'refunds', rate: -0.008 },
    { type: 'Refund Fees',         name: 'Scheme Fees - Refund',        basis: 'refunds',   rate: 0.001  },
    // Chargeback Fees — flat per chargeback
    { type: 'Chargeback Service Fees', name: 'Commission Markup - Chargeback', basis: 'per_cb', flat: 15.0 },
    { type: 'Chargeback Service Fees', name: 'Interchange Issuing Bank - ChargebackReversed', basis: 'cb_volume', rate: 0.009 },
    { type: 'Chargeback Service Fees', name: 'Commission - ChargebackReversed', basis: 'cb_volume', rate: 0.002 },
  ];

  for (const merchant of MERCHANTS) {
    const captures    = txns.filter(t => t.merchant.ah === merchant.ah && t.status === 'captured');
    const refunds     = txns.filter(t => t.merchant.ah === merchant.ah && t.status === 'refunded');
    const chargebacks = txns.filter(t => t.merchant.ah === merchant.ah && t.status === 'chargeback');

    const totalVolume  = round2(captures.reduce((s, t) => s + t.amount, 0));
    const totalRefunds = round2(Math.abs(refunds.reduce((s, t) => s + t.amount, 0)));
    const totalCbVol   = round2(Math.abs(chargebacks.reduce((s, t) => s + t.amount, 0)));
    const txnCount     = captures.length;
    const cbCount      = chargebacks.length;

    for (const fee of FEE_STRUCTURE) {
      let amount;
      switch (fee.basis) {
        case 'volume':    amount = round2(totalVolume  * fee.rate);  break;
        case 'refunds':   amount = round2(totalRefunds * fee.rate);  break;
        case 'cb_volume': amount = round2(totalCbVol   * fee.rate);  break;
        case 'per_txn':   amount = round2(txnCount     * fee.flat);  break;
        case 'per_cb':    amount = round2(cbCount       * fee.flat);  break;
      }
      if (amount !== 0) {
        rows.push(['2024-07-01', BALANCE_PLATFORM, merchant.ah, merchant.ba, fee.type, fee.name, CURRENCY, amount]);
      }
    }
  }

  return toCsv(rows);
}

// ─── Report 4: Statement Report ───────────────────────────────────────────────
//
// One section per AccountHolder.
// Structure: opening sentinel row → transaction rows → closing sentinel row.
// Sentinel rows have empty transaction fields; they carry the period balances.
// Opening balance is always 0 (clean month start for demo purposes).

function buildStatementReport(txns) {
  const COLS = [
    'BalancePlatform','AccountHolder','BalanceAccount',
    'Category','Type','Status','Transfer Id','Transaction Id',
    'Psp Payment Merchant Reference','Psp Payment Psp Reference',
    'Psp Modification Psp Reference','Psp Modification Merchant Reference',
    'Reference','Description',
    'Booking Date','Booking Date TimeZone',
    'Value Date','Value Date TimeZone',
    'Currency','Amount',
    'Starting Balance Currency','Starting Balance',
    'Ending Balance Currency','Ending Balance',
    'Reserved1','Reserved2','Reserved3','Reserved4','Reserved5',
    'Reserved6','Reserved7','Reserved8','Reserved9','Reserved10',
  ];

  const rows = [COLS];
  const empty10 = Array(10).fill('');

  function makeRow(fields) {
    return COLS.map(col => fields[col] ?? '');
  }

  for (const merchant of MERCHANTS) {
    // Only include booked/settled transactions in the statement
    const merchantTxns = txns
      .filter(t => t.merchant.ah === merchant.ah &&
        ['captured', 'refunded', 'chargeback', 'chargebackReversed'].includes(t.status))
      .sort((a, b) => a.bookingDate - b.bookingDate);

    const closingBalance = round2(merchantTxns.reduce((s, t) => s + t.amount, 0));

    // Opening sentinel — Amount = opening balance (0 for demo)
    rows.push(makeRow({
      'BalancePlatform': BALANCE_PLATFORM,
      'AccountHolder':   merchant.ah,
      'BalanceAccount':  merchant.ba,
      'Currency':        CURRENCY,
      'Amount':          '0.00',
    }));

    // Transaction rows
    for (const txn of merchantTxns) {
      rows.push(makeRow({
        'BalancePlatform':          BALANCE_PLATFORM,
        'AccountHolder':            merchant.ah,
        'BalanceAccount':           merchant.ba,
        'Category':                 'platformPayment',
        'Type':                     txn.type,
        'Status':                   txn.status,
        'Transfer Id':              txn.transferId,
        'Transaction Id':           txn.txnId,
        'Psp Payment Merchant Reference': txn.merchantRef,
        'Psp Payment Psp Reference':      txn.pspRef,
        'Reference':                txn.merchantRef,
        'Description':              `Order ${txn.merchantRef}`,
        'Booking Date':             fmtDate(txn.bookingDate),
        'Booking Date TimeZone':    TIMEZONE,
        'Value Date':               fmtDate(txn.valueDate),
        'Value Date TimeZone':      TIMEZONE,
        'Currency':                 CURRENCY,
        'Amount':                   txn.amount,
      }));
    }

    // Closing sentinel — carries the period-end balance
    rows.push(makeRow({
      'BalancePlatform':       BALANCE_PLATFORM,
      'AccountHolder':         merchant.ah,
      'BalanceAccount':        merchant.ba,
      'Ending Balance Currency': CURRENCY,
      'Ending Balance':          closingBalance,
    }));
  }

  return toCsv(rows);
}

// ─── Report 5: Payment Accounting Report ─────────────────────────────────────
//
// Merchant-account level report. Tracks payment lifecycle at the acquiring layer.
// DIFFERENT from the BP Accounting Report — this is pre-split, pre-platform.
//
// Key linkage:
//   Psp Reference (this report) = Psp Payment Psp Reference (BP Accounting Report)
//   This is the cross-report join that powers reconcile-payments and reconcile-fees.
//
// Record types and what populates:
//   Received      → Processing Fee (FC) = -0.10 (per-event cost charged by Adyen)
//   Authorised    → no fee columns
//   SentForSettle → no fee columns; this is the trigger for BP Accounting bookings
//   Settled       → Interchange (SC), Scheme Fees (SC), Markup (SC), Payable (SC)
//
// Only captures appear — refunds/CBs have their own flows and are omitted here
// to keep the demo focused on the payment reconciliation use case.
//
// Intentional gaps: 3 SentForSettle rows are written with NO corresponding
// captured row in the BP Accounting Report. These simulate real-world gaps
// (e.g. a payment that settled at the acquirer but whose split booking failed).
// They are flagged with Merchant Reference prefix "UNMATCHED-".

function buildPaymentAccountingReport(txns) {
  const COLS = [
    'Company Account','Merchant Account','Psp Reference','Merchant Reference',
    'Payment Method','Booking Date','TimeZone','Main Currency','Main Amount',
    'Record Type','Payment Currency','Received (PC)','Authorised (PC)','Captured (PC)',
    'Settlement Currency','Payable (SC)','Commission (SC)','Markup (SC)',
    'Scheme Fees (SC)','Interchange (SC)','Processing Fee Currency','Processing Fee (FC)',
    'User Name','Payment Method Variant','Modification Merchant Reference',
    'Metadata','Merchant Order Reference',
    'Reserved3','Reserved4','Reserved5','Reserved6','Reserved7',
    'Reserved8','Reserved9','Reserved10',
  ];

  const rows = [COLS];

  // Fee rates applied at settlement (Settled row only)
  const FEE_RATES = {
    interchange:  0.0190,   // 1.90% interchange
    schemeFees:   0.0017,   // 0.17% scheme fees
    markup:       0.0050,   // 0.50% platform markup
    commission:   0.0000,   // commission flows to liable account via splits, not here
    processingFee: -0.10,   // flat -$0.10 per transaction on Received row
  };

  function makeRow(fields) {
    return COLS.map(col => fields[col] ?? '');
  }

  // Only capture transactions appear in the Payment Accounting Report
  const captures = txns.filter(t => t.status === 'captured');

  for (const txn of captures) {
    const { merchant, pspRef, merchantRef, bookingDate, amount } = txn;

    // Merchant account identifier — maps back to the sub-merchant in BP Accounting
    const companyAccount  = 'DemoCompany';
    const merchantAccount = `MA-${merchant.ahRef}`;
    const bookingStr      = fmtDateISO(bookingDate);
    const paymentMethod   = 'mc'; // Mastercard for all demo transactions

    // Calculate settlement fees for this transaction
    const interchange  = round2(amount * FEE_RATES.interchange);
    const schemeFees   = round2(amount * FEE_RATES.schemeFees);
    const markup       = round2(amount * FEE_RATES.markup);
    const commission   = 0;
    const payable      = round2(amount - interchange - schemeFees - markup);

    // ── Row 1: Received ──────────────────────────────────────────────────────
    // Processing Fee (FC) is the only fee column populated here.
    rows.push(makeRow({
      'Company Account':       companyAccount,
      'Merchant Account':      merchantAccount,
      'Psp Reference':         pspRef,   // ← THE JOIN KEY to BP Accounting
      'Merchant Reference':    merchantRef,
      'Payment Method':        paymentMethod,
      'Booking Date':          bookingStr,
      'TimeZone':              TIMEZONE,
      'Main Currency':         CURRENCY,
      'Main Amount':           amount,
      'Record Type':           'Received',
      'Payment Currency':      CURRENCY,
      'Received (PC)':         amount,
      'Authorised (PC)':       0,
      'Captured (PC)':         0,
      'Processing Fee Currency': CURRENCY,
      'Processing Fee (FC)':   FEE_RATES.processingFee,
      'User Name':             `pos_ws_${merchant.ahRef}@DemoCompany`,
      'Payment Method Variant': 'mc_debit',
    }));

    // ── Row 2: Authorised ────────────────────────────────────────────────────
    rows.push(makeRow({
      'Company Account':    companyAccount,
      'Merchant Account':   merchantAccount,
      'Psp Reference':      pspRef,
      'Merchant Reference': merchantRef,
      'Payment Method':     paymentMethod,
      'Booking Date':       bookingStr,
      'TimeZone':           TIMEZONE,
      'Main Currency':      CURRENCY,
      'Main Amount':        amount,
      'Record Type':        'Authorised',
      'Payment Currency':   CURRENCY,
      'Received (PC)':      -amount,
      'Authorised (PC)':    amount,
      'Captured (PC)':      0,
      'User Name':          `pos_ws_${merchant.ahRef}@DemoCompany`,
    }));

    // ── Row 3: SentForSettle ─────────────────────────────────────────────────
    // This is the trigger point. When this row appears, the BP Accounting
    // Report should show a corresponding captured row with the same PSP ref.
    rows.push(makeRow({
      'Company Account':    companyAccount,
      'Merchant Account':   merchantAccount,
      'Psp Reference':      pspRef,
      'Merchant Reference': merchantRef,
      'Payment Method':     paymentMethod,
      'Booking Date':       bookingStr,
      'TimeZone':           TIMEZONE,
      'Main Currency':      CURRENCY,
      'Main Amount':        amount,
      'Record Type':        'SentForSettle',
      'Payment Currency':   CURRENCY,
      'Received (PC)':      0,
      'Authorised (PC)':    -amount,
      'Captured (PC)':      amount,
      'User Name':          `pos_ws_${merchant.ahRef}@DemoCompany`,
    }));

    // ── Row 4: Settled ───────────────────────────────────────────────────────
    // Fee breakdown columns are ONLY populated on this row.
    // Payable (SC) = amount after all fee deductions.
    rows.push(makeRow({
      'Company Account':    companyAccount,
      'Merchant Account':   merchantAccount,
      'Psp Reference':      pspRef,
      'Merchant Reference': merchantRef,
      'Payment Method':     paymentMethod,
      'Booking Date':       bookingStr,
      'TimeZone':           TIMEZONE,
      'Main Currency':      CURRENCY,
      'Main Amount':        amount,
      'Record Type':        'Settled',
      'Payment Currency':   CURRENCY,
      'Settlement Currency': CURRENCY,
      'Payable (SC)':       payable,
      'Commission (SC)':    commission,
      'Markup (SC)':        markup,
      'Scheme Fees (SC)':   schemeFees,
      'Interchange (SC)':   interchange,
      'User Name':          `pos_ws_${merchant.ahRef}@DemoCompany`,
    }));
  }

  // ── Intentional reconciliation gaps ─────────────────────────────────────────
  // These 3 transactions exist in the Payment Accounting Report (SentForSettle)
  // but have NO corresponding captured row in the BP Accounting Report.
  // This simulates a real gap — payment settled at the acquirer but the
  // balance platform booking failed or was delayed.
  //
  // The reconcile-payments route should surface these as unmatched.
  const GAP_MERCHANTS = [MERCHANTS[0], MERCHANTS[1], MERCHANTS[4]]; // Bella, Tech, Swift
  for (let i = 0; i < GAP_MERCHANTS.length; i++) {
    const m      = GAP_MERCHANTS[i];
    const pspRef = genPspRef(); // brand new PSP ref — NOT in BP Accounting
    const amount = round2(m.avgTxn * 1.1);
    const gapRef = `UNMATCHED-GAP-00${i + 1}`;
    const gapDate = new Date(`2024-07-${15 + i}T14:00:00Z`);
    const bookingStr = fmtDateISO(gapDate);
    const companyAccount  = 'DemoCompany';
    const merchantAccount = `MA-${m.ahRef}`;

    // Write only Received + Authorised + SentForSettle — NO Settled row.
    // The absence of a captured BP Accounting row makes these unreconciled.
    for (const [recordType, rcvd, auth, capt] of [
      ['Received',      amount,  0,       0     ],
      ['Authorised',    -amount, amount,  0     ],
      ['SentForSettle', 0,       -amount, amount],
    ]) {
      rows.push(makeRow({
        'Company Account':       companyAccount,
        'Merchant Account':      merchantAccount,
        'Psp Reference':         pspRef,
        'Merchant Reference':    gapRef,
        'Payment Method':        'mc',
        'Booking Date':          bookingStr,
        'TimeZone':              TIMEZONE,
        'Main Currency':         CURRENCY,
        'Main Amount':           amount,
        'Record Type':           recordType,
        'Payment Currency':      CURRENCY,
        'Received (PC)':         rcvd,
        'Authorised (PC)':       auth,
        'Captured (PC)':         capt,
        'Processing Fee Currency': recordType === 'Received' ? CURRENCY : '',
        'Processing Fee (FC)':   recordType === 'Received' ? -0.10 : '',
        'User Name':             `pos_ws_${m.ahRef}@DemoCompany`,
      }));
    }
  }

  return toCsv(rows);
}

// ─── Report 6: Balance Platform Balance Report ────────────────────────────────
//
// Daily balance snapshots — one row per merchant per day for July 2024.
// Opening Balance on day N = Closing Balance from day N-1.
// Closing Balance = Opening Balance + net daily activity from the transactions.
//
// Key linkage:
//   Account Holder + Balance Account → same IDs as all other BP reports
//   Closing Balance Amount should equal the sum of Balance (PC) in
//   BP Accounting Report for that account up to (and including) that date.
//
// Intentional discrepancies: 3 specific merchant-day combinations are written
// with a Closing Balance that is off by $5–15 from the correct calculated value.
// The reconcile-balances route should surface these.
// They are spread across different merchants so the discrepancy pattern is
// visible in the verify-balances UI component.

function buildBalanceReport(txns) {
  const COLS = [
    'Balance Platform','Account Holder','Balance Account',
    'Opening Balance Currency','Opening Balance Amount','Opening Date','Opening TimeZone',
    'Closing Balance Currency','Closing Balance Amount','Closing Date','Closing TimeZone',
    'Reserved1','Reserved2','Reserved3','Reserved4','Reserved5',
    'Reserved6','Reserved7','Reserved8','Reserved9','Reserved10',
  ];

  const rows = [COLS];

  // Deliberate discrepancies: { merchant index, day, delta }
  // Delta = amount added to the correct closing balance to create the discrepancy.
  // Positive delta = reported balance is higher than reality (over-reported).
  // Negative delta = reported balance is lower than reality (under-reported).
  const DISCREPANCIES = [
    { merchantIdx: 1, day: 8,  delta:  12.50 },   // Tech Gadgets, July 8
    { merchantIdx: 4, day: 15, delta: -7.25  },   // Swift Delivery, July 15
    { merchantIdx: 2, day: 22, delta:  5.00  },   // Urban Fitness, July 22
  ];

  for (let mIdx = 0; mIdx < MERCHANTS.length; mIdx++) {
    const merchant = MERCHANTS[mIdx];

    // Pre-compute net activity per day for this merchant.
    // Net activity = sum of all captured/refunded/chargeback/cbReversal amounts
    // that have a Value Date falling on that calendar day (T+2 from booking).
    // We use Value Date here because the Balance Report reflects when funds
    // are available — same basis as Balance (PC) in BP Accounting.
    const dailyNet = {};
    for (const txn of txns) {
      if (txn.merchant.ah !== merchant.ah) continue;
      if (!['captured','refunded','chargeback','chargebackReversed'].includes(txn.status)) continue;

      // Use Value Date (settlement date) as the key, not Booking Date
      const vd = txn.valueDate;
      if (vd.getMonth() !== 6) continue; // July only
      const dayKey = vd.getDate();
      dailyNet[dayKey] = round2((dailyNet[dayKey] ?? 0) + txn.amount);
    }

    let runningBalance = 0; // July starts at 0 (clean month start)

    for (let day = 1; day <= 31; day++) {
      const openingDate = new Date(`2024-07-${String(day).padStart(2,'0')}T00:00:00Z`);
      if (openingDate.getMonth() !== 6) continue;

      const closingDate = new Date(`2024-07-${String(day).padStart(2,'0')}T23:59:59Z`);

      const openingBalance = runningBalance;
      const netActivity    = dailyNet[day] ?? 0;
      let   closingBalance = round2(openingBalance + netActivity);

      // Apply intentional discrepancy if this is a flagged merchant-day combo
      const disc = DISCREPANCIES.find(d => d.merchantIdx === mIdx && d.day === day);
      const reportedClosing = disc
        ? round2(closingBalance + disc.delta)
        : closingBalance;

      rows.push(COLS.map(col => ({
        'Balance Platform':          BALANCE_PLATFORM,
        'Account Holder':            merchant.ah,
        'Balance Account':           merchant.ba,
        'Opening Balance Currency':  CURRENCY,
        'Opening Balance Amount':    openingBalance,
        'Opening Date':              fmtDateISO(openingDate),
        'Opening TimeZone':          TIMEZONE,
        'Closing Balance Currency':  CURRENCY,
        'Closing Balance Amount':    reportedClosing,   // may differ from calculated
        'Closing Date':              fmtDateISO(closingDate),
        'Closing TimeZone':          TIMEZONE,
      }[col] ?? '')));

      // Always advance running balance using the CORRECT value, not the
      // reported one — the discrepancy is a one-day reporting error,
      // not a compounding error across the whole month.
      runningBalance = closingBalance;
    }
  }

  return toCsv(rows);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('Generating July 2024 transactions...');
  const txns = generateTransactions();

  const captures    = txns.filter(t => t.status === 'captured');
  const refunds     = txns.filter(t => t.status === 'refunded');
  const chargebacks = txns.filter(t => t.status === 'chargeback');
  const reversals   = txns.filter(t => t.status === 'chargebackReversed');

  console.log(`  Captures:            ${captures.length}`);
  console.log(`  Refunds:             ${refunds.length}`);
  console.log(`  Chargebacks:         ${chargebacks.length}`);
  console.log(`  CB Reversals:        ${reversals.length}`);
  console.log(`  Total events:        ${txns.length}`);

  console.log('\nBuilding reports...');

  const files = {
    'balanceplatform_accounting_report_2024_07.csv': buildAccountingReport(txns),
    'balanceplatform_payout_report_2024_07.csv':     buildPayoutReport(txns),
    'balanceplatform_fee_report_2024_07.csv':        buildFeeReport(txns),
    'balance_platform_statement_report_2024_07.csv': buildStatementReport(txns),
    'payment_accounting_report_2024_07.csv':         buildPaymentAccountingReport(txns),
    'balanceplatform_balance_report_2024_07.csv':    buildBalanceReport(txns),
  };

  for (const [filename, content] of Object.entries(files)) {
    const path = join(__dirname, filename);
    writeFileSync(path, content, 'utf8');
    const lines = content.split('\n').length - 1;
    console.log(`  ✓ ${filename} (${lines.toLocaleString()} rows)`);
  }

  console.log('\n── Linkage summary ──────────────────────────────────────────────────');
  console.log('  Transfer Id          → BP Accounting ↔ Payout Report');
  console.log('  Psp Reference        → Payment Accounting ↔ BP Accounting');
  console.log('                         (Payment Accounting.Psp Reference');
  console.log('                          = BP Accounting.Psp Payment Psp Reference)');
  console.log('  AccountHolder        → All 6 reports');
  console.log('  BalanceAccount       → All 6 reports');
  console.log('  Value Date T+2       → BP Accounting captured row = Payout Date');
  console.log('  Balance Report date  → BP Accounting Balance (PC) cumulative sum');
  console.log('\n── Intentional reconciliation gaps ──────────────────────────────────');
  console.log('  Payment Accounting: 3 UNMATCHED- SentForSettle rows (no BP captured row)');
  console.log('    → Reconcile-payments route should surface these as unmatched');
  console.log('  Balance Report: 3 discrepancies (Tech Gadgets Jul 8, Swift Delivery Jul 15,');
  console.log('    Urban Fitness Jul 22) — off by $12.50, -$7.25, $5.00 respectively');
  console.log('    → Reconcile-balances route should surface these as discrepancies');
  console.log('\nDrop all 6 files in /server/mock/reports/');
}
main();