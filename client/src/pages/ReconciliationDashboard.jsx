import { useState, useEffect } from 'react';
import client from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import ReconcilePayments from '../components/ReconcilePayments.jsx';
import ReconcileTransfers from '../components/ReconcileTransfers.jsx';
import ReconcileFees from '../components/ReconcileFees.jsx';
import VerifyBalances from '../components/VerifyBalances.jsx';

const TABS = ['Payments', 'Transfers', 'Fees', 'Balances'];

function SummaryBar({ summaries, loading }) {
  if (loading) return <div className="flex gap-2"><Spinner size="sm" /></div>;
  if (!summaries) return null;

  const { payments, transfers, fees, balances } = summaries;
  const items = [
    payments && `Payments: ${payments.matched.toLocaleString()}/${payments.total.toLocaleString()} reconciled`,
    transfers && `Transfers: ${transfers.complete.toLocaleString()}/${transfers.total.toLocaleString()} complete`,
    fees && `Fees: ${fees.matched.toLocaleString()}/${fees.total.toLocaleString()} matched`,
    balances && `Balances: ${balances.verified.toLocaleString()}/${balances.total.toLocaleString()} verified`,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
      {items.map((item, i) => (
        <span key={i} className="bg-white border border-gray-200 rounded-full px-3 py-1">
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ReconciliationDashboard() {
  const [activeTab, setActiveTab] = useState('Payments');
  const [summaries, setSummaries] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tabData, setTabData] = useState({});
  const [tabLoading, setTabLoading] = useState({});
  const [tabErrors, setTabErrors] = useState({});

  // Load all 4 summaries in parallel on mount
  useEffect(() => {
    setSummaryLoading(true);
    Promise.all([
      client.get('/reconciliation/payments'),
      client.get('/reconciliation/transfers'),
      client.get('/reconciliation/fees'),
      client.get('/reconciliation/balances'),
    ])
      .then(([p, t, f, b]) => {
        setSummaries({
          payments: p.data.summary,
          transfers: t.data.summary,
          fees: f.data.summary,
          balances: b.data.summary,
        });
        // Cache all tab data while we have it
        setTabData({
          Payments: p.data,
          Transfers: t.data,
          Fees: f.data,
          Balances: b.data,
        });
      })
      .catch(() => setSummaries(null))
      .finally(() => setSummaryLoading(false));
  }, []);

  function loadTab(tab) {
    if (tabData[tab] || tabLoading[tab]) return;
    const endpointMap = {
      Payments: '/reconciliation/payments',
      Transfers: '/reconciliation/transfers',
      Fees: '/reconciliation/fees',
      Balances: '/reconciliation/balances',
    };
    setTabLoading(prev => ({ ...prev, [tab]: true }));
    setTabErrors(prev => ({ ...prev, [tab]: null }));
    client.get(endpointMap[tab])
      .then(({ data }) => setTabData(prev => ({ ...prev, [tab]: data })))
      .catch(err => setTabErrors(prev => ({ ...prev, [tab]: err.message })))
      .finally(() => setTabLoading(prev => ({ ...prev, [tab]: false })));
  }

  function handleTabClick(tab) {
    setActiveTab(tab);
    loadTab(tab);
  }

  const data = tabData[activeTab];
  const loading = tabLoading[activeTab];
  const error = tabErrors[activeTab];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Reconciliation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cross-reference Payment Accounting, BP Accounting, and Balance reports to detect gaps and discrepancies.
        </p>
      </div>

      {/* Summary bar */}
      <SummaryBar summaries={summaries} loading={summaryLoading} />

      {/* Tab nav */}
      <div className="flex gap-0 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {summaries && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                getTabBadgeClass(tab, summaries)
              }`}>
                {getTabBadgeCount(tab, summaries)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {loading && (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => { setTabErrors(prev => ({ ...prev, [activeTab]: null })); loadTab(activeTab); }}
              className="text-red-600 underline ml-3 text-sm">Retry</button>
          </div>
        )}
        {!loading && !error && data && (
          <>
            {activeTab === 'Payments' && <ReconcilePayments data={data} />}
            {activeTab === 'Transfers' && <ReconcileTransfers data={data} />}
            {activeTab === 'Fees' && <ReconcileFees data={data} />}
            {activeTab === 'Balances' && <VerifyBalances data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

function getTabBadgeClass(tab, summaries) {
  const issues = getTabIssues(tab, summaries);
  return issues > 0
    ? 'bg-red-100 text-red-700'
    : 'bg-green-100 text-green-700';
}

function getTabBadgeCount(tab, summaries) {
  return getTabIssues(tab, summaries);
}

function getTabIssues(tab, summaries) {
  if (!summaries) return 0;
  if (tab === 'Payments') return summaries.payments?.unmatched || 0;
  if (tab === 'Transfers') return summaries.transfers?.incomplete || 0;
  if (tab === 'Fees') return summaries.fees?.discrepancies || 0;
  if (tab === 'Balances') return summaries.balances?.discrepancies || 0;
  return 0;
}
