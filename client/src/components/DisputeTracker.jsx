import { useState, useEffect } from 'react';
import client from '../api/client.js';
import { useMerchant } from '../MerchantContext.jsx';
import Spinner from './Spinner.jsx';
import { formatCurrency, formatDate } from '../utils.js';

const DISPUTE_TYPES = new Set(['chargeback', 'chargebackReversal', 'secondChargeback']);

const DISPUTE_BADGE = {
  chargeback: 'bg-red-100 text-red-800',
  chargebackReversal: 'bg-green-100 text-green-800',
  secondChargeback: 'bg-red-200 text-red-900 font-semibold',
};

export default function DisputeTracker() {
  const balanceAccountId = useMerchant();
  const [disputes, setDisputes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    if (!balanceAccountId) return;
    setLoading(true);
    setError(null);
    client.get('/transactions', { params: { balanceAccountId } })
      .then(({ data }) => {
        setDisputes(data.data.filter(t => DISPUTE_TYPES.has(t.type)));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [balanceAccountId]);

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

  if (!disputes || disputes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-gray-500">No disputes in this period.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Dispute Tracker</h3>
        <span className="text-xs text-gray-400">{disputes.length} dispute(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left p-3 text-xs text-gray-500">Date</th>
              <th className="text-left p-3 text-xs text-gray-500">PSP Ref</th>
              <th className="text-left p-3 text-xs text-gray-500">Type</th>
              <th className="text-left p-3 text-xs text-gray-500">Status</th>
              <th className="text-right p-3 text-xs text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((d, i) => (
              <tr key={i} className="border-t border-gray-50">
                <td className="p-3 text-gray-600">{formatDate(d.bookingDate)}</td>
                <td className="p-3 font-mono text-xs text-gray-500">{d.pspRef}</td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${DISPUTE_BADGE[d.type] || 'bg-gray-100 text-gray-700'}`}>
                    {d.type}
                  </span>
                </td>
                <td className="p-3 text-gray-600 capitalize">{d.status}</td>
                <td className={`p-3 text-right font-mono ${d.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(d.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
