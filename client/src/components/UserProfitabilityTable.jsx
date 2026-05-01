import { useState, useEffect } from 'react';
import client from '../api/client.js';
import Spinner from './Spinner.jsx';
import { formatCurrency } from '../utils.js';

const COLUMNS = [
  { key: 'merchantName', label: 'Merchant', numeric: false },
  { key: 'volume', label: 'Volume', numeric: true },
  { key: 'txnCount', label: 'Txns', numeric: true },
  { key: 'commission', label: 'Commission', numeric: true },
  { key: 'fees', label: 'Fees', numeric: true },
  { key: 'profit', label: 'Profit', numeric: true },
  { key: 'effectiveRate', label: 'Effective Rate', numeric: true },
];

export default function UserProfitabilityTable() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('profit');
  const [sortDir, setSortDir] = useState('desc');

  function load() {
    setLoading(true);
    setError(null);
    client.get('/platform/user-profitability')
      .then(({ data }) => setRows(data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = rows ? [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  }) : [];

  if (loading) return <div className="bg-white rounded-lg border border-gray-200 p-8 flex justify-center"><Spinner size="lg" /></div>;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <span className="text-red-700 text-sm">{error}</span>
      <button onClick={load} className="text-sm text-red-600 underline ml-4">Retry</button>
    </div>
  );
  if (!rows || rows.length === 0) return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400">
      No merchant data available.
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Merchant Profitability</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`p-3 text-xs text-gray-500 font-medium cursor-pointer hover:bg-gray-100 select-none ${col.numeric ? 'text-right' : 'text-left'}`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                className={`border-t border-gray-50 ${row.profit < 0 ? 'bg-red-50' : ''}`}
              >
                <td className="p-3 font-medium text-gray-800">{row.merchantName}</td>
                <td className="p-3 text-right font-mono text-gray-700">{formatCurrency(row.volume)}</td>
                <td className="p-3 text-right text-gray-600">{row.txnCount.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-gray-700">{formatCurrency(row.commission)}</td>
                <td className="p-3 text-right font-mono text-gray-700">{formatCurrency(row.fees)}</td>
                <td className={`p-3 text-right font-mono font-medium ${row.profit < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(row.profit)}
                </td>
                <td className="p-3 text-right text-gray-600">{row.effectiveRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
