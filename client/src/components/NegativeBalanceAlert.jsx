import { useState, useEffect } from 'react';
import client from '../api/client.js';
import Spinner from './Spinner.jsx';
import { formatCurrency } from '../utils.js';

export default function NegativeBalanceAlert() {
  const [statements, setStatements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    client.get('/statement')
      .then(({ data }) => setStatements(data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <div className="flex justify-center py-2"><Spinner size="sm" /></div>;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
      <span className="text-red-700">{error}</span>
      <button onClick={load} className="text-red-600 underline ml-3">Retry</button>
    </div>
  );
  if (!statements) return null;

  const negatives = statements.filter(s => s.closingBalance < 0);

  if (negatives.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-full text-sm text-green-700">
        <span>✓</span>
        <span>All balances healthy</span>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-300 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠</span>
          <span className="font-semibold text-red-800">
            {negatives.length} merchant{negatives.length > 1 ? 's' : ''} have negative balance{negatives.length > 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-sm text-red-600 hover:underline"
        >
          {expanded ? 'Hide ▲' : 'Details ▼'}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2">
          {negatives.map((s, i) => (
            <div key={i} className="flex justify-between text-sm bg-white rounded px-3 py-2 border border-red-200">
              <span className="text-gray-800">{s.merchantName}</span>
              <span className="text-red-600 font-mono font-medium">{formatCurrency(s.closingBalance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
