import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { FetchError } from '../components/FetchError';
import { formatCents, formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface PaymentRow {
  id: string;
  stripe_payment_intent_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  customer_email: string;
  booking_id: string | null;
  payment_type: string;
  receipt_sent_at: string | null;
  created_at: string;
}

export function PaymentsPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const { data, error, loading, setError } = useFetch(
    () => api.get<{ items: PaymentRow[] }>('/api/payments').then((d) => d.items ?? []),
    []
  );

  const items = data ?? [];

  const resendReceipt = async (paymentId: string) => {
    setBusy(paymentId);
    setMessage('');
    try {
      await api.post('/api/emails/receipt', { paymentId });
      setMessage('Receipt sent');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <h2 className="page-title mb-4">Payments</h2>
      <FetchError message={error} onDismiss={() => setError('')} />
      {message && <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {loading && items.length === 0 ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={items}
          columns={[
            { key: 'customer_email', label: 'Email' },
            { key: 'amount_cents', label: 'Amount', render: (r) => formatCents(r.amount_cents, r.currency) },
            { key: 'status', label: 'Status' },
            { key: 'payment_type', label: 'Type' },
            {
              key: 'booking_id',
              label: 'Booking',
              render: (r) =>
                r.booking_id ? (
                  <Link to={`/bookings/${r.booking_id}`} className="text-blue-600 hover:underline">
                    View
                  </Link>
                ) : (
                  '—'
                ),
            },
            {
              key: 'receipt_sent_at',
              label: 'Receipt',
              render: (r) => (r.receipt_sent_at ? formatDate(r.receipt_sent_at) : 'Not sent'),
            },
            { key: 'created_at', label: 'Created', render: (r) => formatDate(r.created_at) },
            {
              key: 'id',
              label: 'Actions',
              render: (r) => (
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => resendReceipt(r.id)}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  {busy === r.id ? 'Sending...' : 'Resend receipt'}
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
