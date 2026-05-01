import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import client from '../api/client.js';
import Spinner from './Spinner.jsx';
import { formatCurrency } from '../utils.js';

function marginCardClass(margin) {
  if (margin > 1.5) return 'bg-green-50 border-green-300';
  if (margin >= 0.5) return 'bg-yellow-50 border-yellow-300';
  return 'bg-red-50 border-red-300';
}

function KpiCard({ label, value, extraClass }) {
  return (
    <div className={`rounded-lg border p-4 ${extraClass || 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function weekLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  // Get week-of-month (1-indexed)
  const day = d.getDate();
  const weekNum = Math.ceil(day / 7);
  return `${month} W${weekNum}`;
}

export default function PlatformProfitability() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    client.get('/platform/profitability')
      .then(({ data: d }) => setData(d))
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
  if (!data) return null;

  const chartData = data.byWeek.map(w => ({
    week: weekLabel(w.weekStart),
    Commission: w.commission,
    Fees: w.fees,
    Profit: w.profit,
  }));

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Net Profit" value={formatCurrency(data.netProfit)} />
        <KpiCard label="Total Commission" value={formatCurrency(data.totalCommission)} />
        <KpiCard label="Total Fees" value={formatCurrency(data.totalFees)} />
        <KpiCard
          label="Margin %"
          value={`${data.marginPercent}%`}
          extraClass={`border ${marginCardClass(data.marginPercent)}`}
        />
        <KpiCard label="Closing Balance" value={formatCurrency(data.liableAccountSummary.closingBalance)} />
      </div>

      {/* Weekly trend chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Profitability Trend</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Line type="monotone" dataKey="Commission" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Fees" stroke="#dc2626" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Profit" stroke="#16a34a" strokeWidth={2} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
