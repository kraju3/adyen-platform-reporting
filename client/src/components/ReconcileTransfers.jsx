import { useState } from 'react';
import { formatCurrency } from '../utils.js';

const PAGE_SIZE = 25;

const STATUS_PILL = {
  received: 'bg-gray-100 text-gray-700',
  authorised: 'bg-blue-100 text-blue-700',
  captured: 'bg-green-100 text-green-700',
  refunded: 'bg-yellow-100 text-yellow-700',
  chargeback: 'bg-red-100 text-red-800',
  fee: 'bg-purple-100 text-purple-700',
  booked: 'bg-gray-200 text-gray-700',
};

export default function ReconcileTransfers({ data }) {
  const [completePage, setCompletePage] = useState(0);
  const [incompletePage, setIncompletePage] = useState(0);

  if (!data) return null;
  const { complete, incomplete } = data;
  const cTotal = Math.ceil(complete.length / PAGE_SIZE);
  const iTotal = Math.ceil(incomplete.length / PAGE_SIZE);
  const cRows = complete.slice(completePage * PAGE_SIZE, (completePage + 1) * PAGE_SIZE);
  const iRows = incomplete.slice(incompletePage * PAGE_SIZE, (incompletePage + 1) * PAGE_SIZE);

  if (incomplete.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-700 font-medium">
        ✓ All transfer lifecycles are complete — no missing statuses.
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Complete panel */}
      <div className="flex-1 rounded-lg border border-green-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-green-200">
          <h4 className="text-sm font-semibold text-green-800">Complete ({complete.length.toLocaleString()})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-green-50">
              <tr>
                <th className="text-left p-2 text-gray-500">Transfer Id</th>
                <th className="text-left p-2 text-gray-500">Merchant</th>
                <th className="text-right p-2 text-gray-500">Amount</th>
                <th className="text-left p-2 text-gray-500">Statuses</th>
              </tr>
            </thead>
            <tbody>
              {cRows.map((r, i) => (
                <tr key={i} className="border-t border-green-50">
                  <td className="p-2 font-mono text-gray-500 truncate max-w-[120px]">{r.transferId}</td>
                  <td className="p-2 text-gray-700 truncate max-w-[100px]">{r.merchantName}</td>
                  <td className={`p-2 text-right font-mono ${r.amount < 0 ? 'text-red-600' : 'text-gray-700'}`}>{formatCurrency(r.amount)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {r.statusesPresent.map(s => (
                        <span key={s} className={`px-1.5 py-0.5 rounded text-xs ${STATUS_PILL[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cTotal > 1 && (
            <div className="flex justify-center gap-2 p-2 text-xs">
              <button onClick={() => setCompletePage(p => Math.max(0, p - 1))} disabled={completePage === 0} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
              <span>{completePage + 1}/{cTotal}</span>
              <button onClick={() => setCompletePage(p => Math.min(cTotal - 1, p + 1))} disabled={completePage >= cTotal - 1} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
            </div>
          )}
        </div>
      </div>

      {/* Incomplete panel */}
      <div className="flex-1 rounded-lg border border-red-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-red-200">
          <h4 className="text-sm font-semibold text-red-800">Incomplete ({incomplete.length.toLocaleString()})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-red-50">
              <tr>
                <th className="text-left p-2 text-gray-500">Transfer Id</th>
                <th className="text-left p-2 text-gray-500">Merchant</th>
                <th className="text-right p-2 text-gray-500">Amount</th>
                <th className="text-left p-2 text-gray-500">Present</th>
                <th className="text-left p-2 text-gray-500">Missing</th>
              </tr>
            </thead>
            <tbody>
              {iRows.map((r, i) => (
                <tr key={i} className="border-t border-red-50 bg-red-50">
                  <td className="p-2 font-mono text-gray-500 truncate max-w-[120px]">{r.transferId}</td>
                  <td className="p-2 text-gray-700 truncate max-w-[100px]">{r.merchantName}</td>
                  <td className="p-2 text-right font-mono text-gray-700">{formatCurrency(r.amount)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {r.statusesPresent.map(s => (
                        <span key={s} className={`px-1.5 py-0.5 rounded text-xs ${STATUS_PILL[s] || 'bg-gray-100'}`}>{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 bg-red-200 text-red-900 rounded text-xs">{r.missingStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {iTotal > 1 && (
            <div className="flex justify-center gap-2 p-2 text-xs">
              <button onClick={() => setIncompletePage(p => Math.max(0, p - 1))} disabled={incompletePage === 0} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
              <span>{incompletePage + 1}/{iTotal}</span>
              <button onClick={() => setIncompletePage(p => Math.min(iTotal - 1, p + 1))} disabled={incompletePage >= iTotal - 1} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
