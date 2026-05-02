import { useState } from 'react';
import DailySalesSummary from '../components/DailySalesSummary.jsx';
import PayoutSummary from '../components/PayoutSummary.jsx';
import FeeBreakdown from '../components/FeeBreakdown.jsx';
import TransactionTable from '../components/TransactionTable.jsx';
import StatementView from '../components/StatementView.jsx';
import DisputeTracker from '../components/DisputeTracker.jsx';
import { MerchantReportGuide } from '../components/DashboardReportGuide.jsx';

export default function MerchantDashboard() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  return (
    <div className="space-y-6">
      <MerchantReportGuide />

      {/* Date range picker */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
        <span className="text-sm text-gray-500 font-medium">Date range:</span>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <span className="text-gray-400">–</span>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Row 1: KPI summary */}
      <DailySalesSummary startDate={startDate} endDate={endDate} />

      {/* Row 2: Payout (40%) + Fees (60%) */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2">
          <PayoutSummary />
        </div>
        <div className="col-span-3">
          <FeeBreakdown startDate={startDate} endDate={endDate} />
        </div>
      </div>

      {/* Row 3: Transaction table */}
      <TransactionTable startDate={startDate} endDate={endDate} />

      {/* Row 4: Statement + Disputes */}
      <div className="grid grid-cols-2 gap-6">
        <StatementView />
        <DisputeTracker />
      </div>
    </div>
  );
}
