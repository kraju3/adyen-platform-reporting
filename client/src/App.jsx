import { useState, useEffect } from 'react';
import client from './api/client.js';
import { MerchantContext } from './MerchantContext.jsx';
import MerchantDashboard from './pages/MerchantDashboard.jsx';
import PlatformDashboard from './pages/PlatformDashboard.jsx';

// Known merchant roster — used to display names without re-fetching
const MERCHANT_NAMES = {
  AH3000000000000000000001: 'Bella Italia Restaurant',
  AH3000000000000000000002: 'Tech Gadgets Store',
  AH3000000000000000000003: 'Urban Fitness Studio',
  AH3000000000000000000004: 'Green Garden Cafe',
  AH3000000000000000000005: 'Swift Delivery Co',
};

export default function App() {
  const [view, setView] = useState('merchant');
  const [merchants, setMerchants] = useState([]);
  const [selectedBalanceAccountId, setSelectedBalanceAccountId] = useState(null);

  useEffect(() => {
    client.get('/transactions').then(({ data }) => {
      // Derive unique merchant pairs from the transaction data
      const seen = new Set();
      const list = [];
      for (const txn of data.data) {
        if (!seen.has(txn.balanceAccount)) {
          seen.add(txn.balanceAccount);
          list.push({
            balanceAccount: txn.balanceAccount,
            accountHolder: txn.accountHolder,
            name: MERCHANT_NAMES[txn.accountHolder] || txn.accountHolder,
          });
        }
      }
      // Sort alphabetically by name
      list.sort((a, b) => a.name.localeCompare(b.name));
      setMerchants(list);
      if (list.length > 0) setSelectedBalanceAccountId(list[0].balanceAccount);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-semibold text-gray-900">Platform Reporting</span>
        </div>

        <div className="flex items-center gap-2">
          {view === 'merchant' && merchants.length > 0 && (
            <select
              className="mr-4 text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
              value={selectedBalanceAccountId || ''}
              onChange={e => setSelectedBalanceAccountId(e.target.value)}
            >
              {merchants.map(m => (
                <option key={m.balanceAccount} value={m.balanceAccount}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setView('merchant')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                view === 'merchant'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Merchant View
            </button>
            <button
              onClick={() => setView('platform')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
                view === 'platform'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Platform View
            </button>
          </div>
        </div>
      </header>

      <MerchantContext.Provider value={selectedBalanceAccountId}>
        <main className="p-6">
          {view === 'merchant' ? <MerchantDashboard /> : <PlatformDashboard />}
        </main>
      </MerchantContext.Provider>
    </div>
  );
}
