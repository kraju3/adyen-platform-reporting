import { useState, useEffect, useMemo } from 'react';
import client from '../api/client.js';
import { useMerchant } from '../MerchantContext.jsx';
import Spinner from './Spinner.jsx';
import { formatCurrency, formatDate, statusBadgeClass } from '../utils.js';

const PAGE_SIZE = 25;
const TYPE_FILTERS = [
  { label: 'All', value: null },
  { label: 'Captures', value: 'capture' },
  { label: 'Refunds', value: 'refund' },
  { label: 'Chargebacks', value: 'chargeback' },
];

export default function TransactionTable({ startDate, endDate }) {
  const balanceAccountId = useMerchant();
  const [txns, setTxns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [page, setPage] = useState(0);

  function load() {
    if (!balanceAccountId) return;
    setLoading(true);
    setError(null);
    setPage(0);
    const params = { balanceAccountId };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    client.get('/transactions', { params })
      .then(({ data }) => setTxns(data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [balanceAccountId, startDate, endDate]);
  // Reset page when filter changes
  useEffect(() => setPage(0), [typeFilter]);

  const filtered = useMemo(() => {
    if (!txns) return [];
    return typeFilter ? txns.filter(t => t.type === typeFilter) : txns;
  }, [txns, typeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 flex justify-center">
      <Spinner size="lg" />
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <span className="text-red-700 text-sm">{error}</span>
      <button onClick={load} className="text-sm text-red-600 underline ml-4">Retry</button>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Transactions</h3>
        <div className="flex gap-1">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                typeFilter === f.value
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p>No transactions match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left p-3 text-xs text-gray-500 font-medium">Date</th>
                  <th className="text-left p-3 text-xs text-gray-500 font-medium">PSP Ref</th>
                  <th className="text-left p-3 text-xs text-gray-500 font-medium">Merchant Ref</th>
                  <th className="text-left p-3 text-xs text-gray-500 font-medium">Type</th>
                  <th className="text-left p-3 text-xs text-gray-500 font-medium">Status</th>
                  <th className="text-right p-3 text-xs text-gray-500 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-600">{formatDate(t.bookingDate)}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{t.pspRef}</td>
                    <td className="p-3 text-gray-600 truncate max-w-[160px]">{t.merchantRef}</td>
                    <td className="p-3 capitalize text-gray-700">{t.type}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-mono ${t.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{filtered.length.toLocaleString()} transactions</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40"
              >
                ← Prev
              </button>
              <span>Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
