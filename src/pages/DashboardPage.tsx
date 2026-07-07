import { Link } from 'react-router-dom';
import { FetchError } from '../components/FetchError';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface DashboardData {
  bookings: { total: number; byStatus: Record<string, number> };
  contacts: number;
  prebookings: number;
  payments: number;
  customers: number;
  unpaidDeposits: number;
}

export function DashboardPage() {
  const { data, error, loading, setError } = useFetch(
    () => api.get<DashboardData>('/api/dashboard'),
    []
  );

  if (loading && !data) return <p className="text-gray-500">Loading...</p>;
  if (error && !data) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-semibold">Could not load dashboard</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }
  if (!data?.bookings) return null;

  return (
    <div>
      <FetchError message={error} onDismiss={() => setError('')} />
      <h2 className="page-title mb-6">Dashboard</h2>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Bookings" value={data.bookings.total} to="/bookings" />
        <StatCard label="Customers" value={data.customers ?? 0} to="/customers" />
        <StatCard label="Contacts" value={data.contacts} to="/records/contacts" />
        <StatCard label="Prebookings" value={data.prebookings} to="/records/prebookings" />
        <StatCard label="Payments" value={data.payments} to="/payments" />
      </div>
      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Bookings by status</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.bookings.byStatus).map(([status, count]) => (
            <span key={status} className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1 text-sm">
              <StatusBadge status={status} />
              <span className="font-medium text-gray-700">{count}</span>
            </span>
          ))}
          {Object.keys(data.bookings.byStatus).length === 0 && (
            <span className="text-sm text-gray-500">No bookings</span>
          )}
        </div>
        {data.unpaidDeposits > 0 && (
          <p className="mt-4 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800">
            {data.unpaidDeposits} pending booking(s) without deposit paid
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="card p-4 transition-colors hover:border-gray-300 hover:bg-gray-50">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
