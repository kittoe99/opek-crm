import { Link, useParams } from 'react-router-dom';
import { FetchError } from '../components/FetchError';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface CustomerDetail {
  customer: { id: string; name: string; phone: string; booking_count: number } | null;
  email: string;
  bookings: Array<{ id: string; order_number: string; status: string; created_at: string }>;
  contacts: Array<{ id: string; created_at: string }>;
  prebookings: Array<{ id: string; status: string; created_at: string }>;
  payments: Array<{ id: string; amount_cents: number; status: string; created_at: string }>;
  stripeCustomers: Array<{ id: string; stripe_customer_id: string }>;
}

export function CustomerDetailPage() {
  const { email = '' } = useParams();

  const { data, error, loading, setError } = useFetch(
    () => api.get<CustomerDetail>(`/api/customers?email=${encodeURIComponent(email)}`),
    [email],
    { enabled: !!email }
  );

  if (loading && !data) return <p className="text-gray-500">Loading...</p>;
  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div>
      <FetchError message={error} onDismiss={() => setError('')} />
      <Link to="/customers" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-800">
        ← Back to customers
      </Link>
      <h2 className="mb-1 text-xl font-bold">{data.customer?.name || data.email}</h2>
      <p className="mb-6 text-sm text-gray-500">{data.email}</p>

      <Section title="Bookings">
        {data.bookings.length === 0 ? (
          <p className="text-sm text-gray-500">None</p>
        ) : (
          <ul className="space-y-2">
            {data.bookings.map((b) => (
              <li key={b.id}>
                <Link to={`/bookings/${b.id}`} className="text-sm text-blue-600 hover:underline">
                  {b.order_number}
                </Link>{' '}
                <StatusBadge status={b.status} />{' '}
                <span className="text-xs text-gray-500">{formatDate(b.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Contacts">
        {data.contacts.length === 0 ? (
          <p className="text-sm text-gray-500">None</p>
        ) : (
          <ul className="text-sm">
            {data.contacts.map((c) => (
              <li key={c.id}>{formatDate(c.created_at)}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Prebookings">
        {data.prebookings.length === 0 ? (
          <p className="text-sm text-gray-500">None</p>
        ) : (
          <ul className="text-sm">
            {data.prebookings.map((p) => (
              <li key={p.id}>
                <StatusBadge status={p.status} /> {formatDate(p.created_at)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Payments">
        {data.payments.length === 0 ? (
          <p className="text-sm text-gray-500">None</p>
        ) : (
          <ul className="text-sm">
            {data.payments.map((p) => (
              <li key={p.id}>
                ${(p.amount_cents / 100).toFixed(2)} — {p.status} — {formatDate(p.created_at)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {data.stripeCustomers.length > 0 && (
        <Section title="Stripe">
          <ul className="text-sm">
            {data.stripeCustomers.map((s) => (
              <li key={s.id}>{s.stripe_customer_id}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-6 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </div>
  );
}
