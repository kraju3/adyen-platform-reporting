import PlatformProfitability from '../components/PlatformProfitability.jsx';
import UserProfitabilityTable from '../components/UserProfitabilityTable.jsx';
import TransactionProfitabilityTable from '../components/TransactionProfitabilityTable.jsx';
import NegativeBalanceAlert from '../components/NegativeBalanceAlert.jsx';
import ExceptionLog from '../components/ExceptionLog.jsx';

export default function PlatformDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Platform Operations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Internal view — aggregate data across all sub-merchants. Not visible to merchants.
        </p>
      </div>

      {/* 1. KPIs + trend chart */}
      <PlatformProfitability />

      {/* 2. Balance health alert */}
      <NegativeBalanceAlert />

      {/* Separator */}
      <div className="border-t border-gray-100" />

      {/* 3. Per-merchant profitability */}
      <UserProfitabilityTable />

      {/* 4. Per-transaction profitability */}
      <TransactionProfitabilityTable />

      {/* 5. Exception log */}
      <ExceptionLog />
    </div>
  );
}
