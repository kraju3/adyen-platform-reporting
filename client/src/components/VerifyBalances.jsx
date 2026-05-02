import { useState } from 'react';
import { formatCurrency, formatDate } from '../utils.js';

const PAGE_SIZE = 25;

export default function VerifyBalances({ data }) {
  const [verifiedPage, setVerifiedPage] = useState(0);
  const [discrepancyPage, setDiscrepancyPage] = useState(0);

  if (!data) return null;
  const { verified, discrepancies } = data;

  const vTotal = Math.ceil(verified.length / PAGE_SIZE);
  const dTotal = Math.ceil(discrepancies.length / PAGE_SIZE);
  const vRows = verified.slice(verifiedPage * PAGE_SIZE, (verifiedPage + 1) * PAGE_SIZE);
  const dRows = discrepancies.slice(discrepancyPage * PAGE_SIZE, (discrepancyPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        <span className="font-medium">Note:</span> Each day's opening balance should equal the prior day's closing balance. A discrepancy indicates
        the Balance Report chain is broken — this may indicate a missing transaction, a manual adjustment,
        or a timing difference in report generation.
      </p>

      <div className="flex gap-4">
        {/* Verified panel */}
        <div className="flex-1 rounded-lg border border-green-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-green-200">
            <h4 className="text-sm font-semibold text-green-800">Verified ({verified.length.toLocaleString()})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-green-50">
                <tr>
                  <th className="text-left p-2 text-gray-500">Merchant</th>
                  <th className="text-left p-2 text-gray-500">Date</th>
                  <th className="text-right p-2 text-gray-500">Opening</th>
                  <th className="text-right p-2 text-gray-500">Closing</th>
                  <th className="p-2 text-center text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {vRows.map((r, i) => (
                  <tr key={i} className="border-t border-green-50">
                    <td className="p-2 text-gray-700 truncate max-w-[120px]">{r.merchantName}</td>
                    <td className="p-2 text-gray-500">{r.date}</td>
                    <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.openingBalance)}</td>
                    <td className="p-2 text-right font-mono text-gray-700">{formatCurrency(r.reportedClosingBalance)}</td>
                    <td className="p-2 text-center">
                      <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">✓</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vTotal > 1 && (
              <div className="flex justify-center gap-2 p-2 text-xs">
                <button onClick={() => setVerifiedPage(p => Math.max(0, p - 1))} disabled={verifiedPage === 0} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
                <span>{verifiedPage + 1}/{vTotal}</span>
                <button onClick={() => setVerifiedPage(p => Math.min(vTotal - 1, p + 1))} disabled={verifiedPage >= vTotal - 1} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
              </div>
            )}
          </div>
        </div>

        {/* Discrepancies panel */}
        <div className="flex-1 rounded-lg border border-red-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-red-200">
            <h4 className="text-sm font-semibold text-red-800">Discrepancies ({discrepancies.length.toLocaleString()})</h4>
          </div>
          {discrepancies.length === 0 ? (
            <div className="p-6 text-center text-green-600 text-sm">
              ✓ All balance chains are intact.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-red-50">
                  <tr>
                    <th className="text-left p-2 text-gray-500">Merchant</th>
                    <th className="text-left p-2 text-gray-500">Date</th>
                    <th className="text-right p-2 text-gray-500">Reported</th>
                    <th className="text-right p-2 text-gray-500">Calculated</th>
                    <th className="text-right p-2 text-gray-500">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {dRows.map((r, i) => (
                    <tr key={i} className="border-t border-red-100 bg-red-50">
                      <td className="p-2 text-gray-700 truncate max-w-[120px]">{r.merchantName}</td>
                      <td className="p-2 text-gray-600">{r.date}</td>
                      <td className="p-2 text-right font-mono text-gray-700">{formatCurrency(r.reportedClosingBalance)}</td>
                      <td className="p-2 text-right font-mono text-gray-600">{formatCurrency(r.calculatedBalance)}</td>
                      <td className={`p-2 text-right font-mono font-medium text-red-600`}>
                        {r.difference > 0 ? '+' : ''}{formatCurrency(r.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dTotal > 1 && (
                <div className="flex justify-center gap-2 p-2 text-xs">
                  <button onClick={() => setDiscrepancyPage(p => Math.max(0, p - 1))} disabled={discrepancyPage === 0} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
                  <span>{discrepancyPage + 1}/{dTotal}</span>
                  <button onClick={() => setDiscrepancyPage(p => Math.min(dTotal - 1, p + 1))} disabled={discrepancyPage >= dTotal - 1} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
