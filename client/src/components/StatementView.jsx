import { useState, useEffect } from 'react';
import client from '../api/client.js';
import { useMerchant } from '../MerchantContext.jsx';
import Spinner from './Spinner.jsx';
import { formatCurrency, formatDate } from '../utils.js';

export default function StatementView() {
  const balanceAccountId = useMerchant();
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    if (!balanceAccountId) return;
    setLoading(true);
    setError(null);
    client.get('/statement', { params: { balanceAccountId } })
      .then(({ data }) => setStatement(data.data[0] || null))
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
  if (!statement) return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-400">
      <div className="text-3xl mb-2">📄</div>
      <p>No statement available.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Statement</h3>
      </div>

      {/* Opening balance */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between text-sm">
        <span className="text-gray-500">Opening Balance</span>
        <span className="font-medium text-gray-700">{formatCurrency(statement.openingBalance)}</span>
      </div>

      {/* Transactions */}
      <div className="overflow-y-auto" style={{ maxHeight: '340px' }}>
        {statement.transactions.length === 0 ? (
          <p className="text-center text-gray-400 p-6">No transactions in statement.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-white sticky top-0 border-b border-gray-100">
              <tr>
                <th className="text-left p-2 text-gray-400">Date</th>
                <th className="text-left p-2 text-gray-400">Type</th>
                <th className="text-left p-2 text-gray-400">Ref</th>
                <th className="text-right p-2 text-gray-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {statement.transactions.map((t, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="p-2 text-gray-500">{formatDate(t.bookingDate)}</td>
                  <td className="p-2 capitalize text-gray-600">{t.type}</td>
                  <td className="p-2 text-gray-400 truncate max-w-[100px]">{t.merchantRef}</td>
                  <td className={`p-2 text-right font-mono ${t.amount < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Closing balance */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between text-sm mt-auto">
        <span className="text-gray-700 font-semibold">Closing Balance</span>
        <span className={`font-bold ${statement.closingBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {formatCurrency(statement.closingBalance)}
        </span>
      </div>
    </div>
  );
}
