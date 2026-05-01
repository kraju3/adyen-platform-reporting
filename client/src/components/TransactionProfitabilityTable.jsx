import { useState, useEffect } from 'react';
import client from '../api/client.js';
import Spinner from './Spinner.jsx';
import { formatCurrency, formatDate } from '../utils.js';

const PAGE_SIZE = 50;

function marginClass(margin) {
  if (margin > 1) return 'text-green-700 bg-green-50';
  if (margin >= 0) return 'text-yellow-700 bg-yellow-50';
  return 'text-red-700 bg-red-50';
}

export default function TransactionProfitabilityTable() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  function load() {
    setLoading(true);
    setError(null);
    client.get('/platform/transaction-profitability')
      .then(({ data }) => setRows(data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <div className="bg-white rounded-lg border border-gray-200 p-8 flex justify-center"><Spinner size="lg" /></div>;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <span className="text-red-700 text-sm">{error}</span>
      <button onClick={load} className="text-sm text-red-600 underline ml-4">Retry</button>
    </div>
  );
  if (!rows || rows.length === 0) return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400">
      No transaction profitability data.
    </div>
  );

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Transaction Profitability</h3>
        <p className="text-xs text-gray-400 mt-0.5">Sorted by margin ascending — worst performers first.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left p-3 text-xs text-gray-500">Date</th>
              <th className="text-left p-3 text-xs text-gray-500">Merchant</th>
              <th className="text-right p-3 text-xs text-gray-500">Amount</th>
              <th className="text-right p-3 text-xs text-gray-500">Commission</th>
              <th className="text-right p-3 text-xs text-gray-500">Est. Fees</th>
              <th className="text-right p-3 text-xs text-gray-500">Profit</th>
              <th className="text-right p-3 text-xs text-gray-500">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="p-3 text-gray-600">{formatDate(r.valueDate)}</td>
                <td className="p-3 text-gray-700">{r.merchantName}</td>
                <td className="p-3 text-right font-mono text-gray-700">{formatCurrency(r.amount)}</td>
                <td className="p-3 text-right font-mono text-gray-700">{formatCurrency(r.commission)}</td>
                <td className="p-3 text-right font-mono text-gray-600">{formatCurrency(r.fees)}</td>
                <td className={`p-3 text-right font-mono ${r.profit < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(r.profit)}
                </td>
                <td className="p-3 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${marginClass(r.marginPercent)}`}>
                    {r.marginPercent}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>{rows.length.toLocaleString()} transactions</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">← Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-40">Next →</button>
        </div>
      </div>
    </div>
  );
}
