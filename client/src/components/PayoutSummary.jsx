import { useState, useEffect } from 'react';
import client from '../api/client.js';
import { useMerchant } from '../MerchantContext.jsx';
import Spinner from './Spinner.jsx';
import { formatCurrency, formatDate } from '../utils.js';

export default function PayoutSummary() {
  const balanceAccountId = useMerchant();
  const [batches, setBatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  function load() {
    if (!balanceAccountId) return;
    setLoading(true);
    setError(null);
    client.get('/payouts', { params: { balanceAccountId } })
      .then(({ data }) => setBatches(data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [balanceAccountId]);

  if (loading) return <div className="bg-white rounded-lg border border-gray-200 p-6 flex justify-center"><Spinner /></div>;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <span className="text-red-700 text-sm">{error}</span>
      <button onClick={load} className="text-sm text-red-600 underline ml-4">Retry</button>
    </div>
  );

  if (!batches || batches.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400">
        <div className="text-3xl mb-2">💸</div>
        <p>No payouts in this period.</p>
      </div>
    );
  }

  const latest = batches[0];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Payout Summary</h3>
      <div className="mb-4">
        <p className="text-3xl font-bold text-gray-900">{formatCurrency(latest.totalAmount)}</p>
        <p className="text-sm text-gray-500 mt-1">
          {formatDate(latest.payoutDate)} &bull; {latest.transactionCount} transactions
        </p>
      </div>

      <button
        onClick={() => setExpanded(expanded === 0 ? null : 0)}
        className="text-sm text-green-600 hover:underline mb-2"
      >
        {expanded === 0 ? 'Hide transactions ▲' : 'View transactions ▼'}
      </button>

      {expanded === 0 && (
        <div className="max-h-64 overflow-y-auto border border-gray-100 rounded mt-2">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-2 text-gray-500">Type</th>
                <th className="text-left p-2 text-gray-500">Ref</th>
                <th className="text-right p-2 text-gray-500">Amount</th>
                <th className="text-right p-2 text-gray-500">Balance</th>
              </tr>
            </thead>
            <tbody>
              {latest.transactions.map((t, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="p-2 capitalize text-gray-700">{t.type}</td>
                  <td className="p-2 text-gray-500 truncate max-w-[120px]">{t.merchantRef}</td>
                  <td className={`p-2 text-right font-mono ${t.amount < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(t.rollingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {batches.length > 1 && (
        <p className="text-xs text-gray-400 mt-3">{batches.length - 1} earlier payouts in period</p>
      )}
    </div>
  );
}
