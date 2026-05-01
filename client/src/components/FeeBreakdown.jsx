import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import client from '../api/client.js';
import { useMerchant } from '../MerchantContext.jsx';
import Spinner from './Spinner.jsx';
import { formatCurrency } from '../utils.js';

const COLORS = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function FeeBreakdown({ startDate, endDate }) {
  const balanceAccountId = useMerchant();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    if (!balanceAccountId) return;
    setLoading(true);
    setError(null);
    const params = { balanceAccountId };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    client.get('/fees', { params })
      .then(({ data }) => setSummary(data.summary))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [balanceAccountId, startDate, endDate]);

  if (loading) return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex justify-center">
      <Spinner />
    </div>
  );
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <span className="text-red-700 text-sm">{error}</span>
      <button onClick={load} className="text-sm text-red-600 underline ml-4">Retry</button>
    </div>
  );
  if (!summary || Object.keys(summary.byType).length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400">
        <div className="text-3xl mb-2">📊</div>
        <p>No fee data available.</p>
      </div>
    );
  }

  const chartData = Object.entries(summary.byType).map(([name, amount]) => ({ name, amount }));
  const hasNetCredit = summary.total < 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Fee Breakdown</h3>
        <span className={`text-sm font-medium ${summary.total < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          Total: {formatCurrency(summary.total)}
        </span>
      </div>
      {hasNetCredit && (
        <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mb-3">
          Net fee credit — refunded interchange exceeds charges.
        </p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis type="number" tickFormatter={v => `$${v.toFixed(0)}`} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatCurrency(v)} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
