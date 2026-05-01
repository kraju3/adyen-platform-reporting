import { useState, useEffect } from 'react';
import client from '../api/client.js';
import Spinner from './Spinner.jsx';
import { formatCurrency, formatDate } from '../utils.js';

const EXCEPTION_TYPES = new Set(['manualCorrection', 'miscCost', 'depositCorrection']);

// Known merchant roster for display
const MERCHANT_NAMES = {
  AH3000000000000000000001: 'Bella Italia',
  AH3000000000000000000002: 'Tech Gadgets',
  AH3000000000000000000003: 'Urban Fitness',
  AH3000000000000000000004: 'Green Garden',
  AH3000000000000000000005: 'Swift Delivery',
};

export default function ExceptionLog() {
  const [exceptions, setExceptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    client.get('/transactions')
      .then(({ data }) => {
        const filtered = data.data.filter(t =>
          EXCEPTION_TYPES.has(t.type) ||
          (t.type === 'bankTransfer' && t.status === 'refused')
        );
        setExceptions(filtered);
      })
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

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Exception Log</h3>
        <p className="text-xs text-amber-700 mt-0.5">These entries require finance team review.</p>
      </div>
      {!exceptions || exceptions.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">✅</div>
          <p>No exceptions this period.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left p-3 text-xs text-gray-500">Date</th>
                <th className="text-left p-3 text-xs text-gray-500">Merchant</th>
                <th className="text-left p-3 text-xs text-gray-500">Type</th>
                <th className="text-left p-3 text-xs text-gray-500">Status</th>
                <th className="text-right p-3 text-xs text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((e, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-amber-50">
                  <td className="p-3 text-gray-600">{formatDate(e.bookingDate)}</td>
                  <td className="p-3 text-gray-700">{MERCHANT_NAMES[e.accountHolder] || e.accountHolder}</td>
                  <td className="p-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                      {e.type}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 capitalize">{e.status}</td>
                  <td className={`p-3 text-right font-mono ${e.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
