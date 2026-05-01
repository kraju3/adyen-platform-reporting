export function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

const STATUS_STYLES = {
  captured: 'bg-blue-100 text-blue-800',
  refunded: 'bg-yellow-100 text-yellow-800',
  chargeback: 'bg-red-100 text-red-800',
  chargebackReversed: 'bg-green-100 text-green-800',
  chargebackReversal: 'bg-green-100 text-green-800',
  secondChargeback: 'bg-red-200 text-red-900',
  booked: 'bg-gray-100 text-gray-700',
  fee: 'bg-purple-100 text-purple-800',
};

export function statusBadgeClass(status) {
  return STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
}
