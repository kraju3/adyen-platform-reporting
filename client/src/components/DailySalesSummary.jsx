import { useState, useEffect } from 'react';
import client from '../api/client.js';
import { useMerchant } from '../MerchantContext.jsx';
import Spinner from './Spinner.jsx';
import { formatCurrency } from '../utils.js';

function KpiCard({ label, value, negative }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-semibold ${negative ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

export default function DailySalesSummary({ startDate, endDate }) {
  const balanceAccountId = useMerchant();
  const [txns, setTxns] = useState(null);
  const [fees, setFees] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    if (!balanceAccountId) return;
    setLoading(true);
    setError(null);
    const params = { balanceAccountId };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    Promise.all([
      client.get('/transactions', { params }),
      client.get('/fees', { params }),
    ])
      .then(([txnRes, feeRes]) => {
        setTxns(txnRes.data.data);
        setFees(feeRes.data.summary);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [balanceAccountId, startDate, endDate]);

  if (loading) return (
    <div className="flex justify-center items-center h-24 bg-white rounded-lg border border-gray-200">
      <Spinner />
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
      <span className="text-red-700 text-sm">{error}</span>
      <button onClick={load} className="text-sm text-red-600 underline ml-4">Retry</button>
    </div>
  );
  if (!txns) return null;

  const gross = txns.filter(t => t.type === 'capture').reduce((s, t) => s + t.amount, 0);
  const refunds = Math.abs(txns.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0));
  const chargebacks = Math.abs(txns.filter(t => t.type === 'chargeback').reduce((s, t) => s + t.amount, 0));
  const feesTotal = fees?.total || 0;
  const net = gross - refunds - chargebacks - feesTotal;

  return (
    <div className="grid grid-cols-5 gap-4">
      <KpiCard label="Gross Sales" value={formatCurrency(gross)} />
      <KpiCard label="Refunds" value={formatCurrency(refunds)} negative={refunds > 0} />
      <KpiCard label="Chargebacks" value={formatCurrency(chargebacks)} negative={chargebacks > 0} />
      <KpiCard label="Fees" value={formatCurrency(feesTotal)} negative={feesTotal > 0} />
      <KpiCard label="Net" value={formatCurrency(net)} negative={net < 0} />
    </div>
  );
}
