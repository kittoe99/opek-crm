import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { FetchError } from '../components/FetchError';
import { StatusBadge } from '../components/StatusBadge';
import { BOOKING_STATUSES, formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface BookingRow {
  id: string;
  order_number: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  preferred_date: string;
  service_type: string;
  created_at: string;
}

export function BookingsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, error, loading, setError } = useFetch(
    () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const q = params.toString() ? `?${params}` : '';
      return api.get<{ items: BookingRow[] }>(`/api/bookings${q}`).then((d) => d.items ?? []);
    },
    [status, search]
  );

  const items = data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="page-title">Bookings</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search order, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <FetchError message={error} onDismiss={() => setError('')} />
      {loading && items.length === 0 ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={items}
          onRowClick={(row) => navigate(`/bookings/${row.id}`)}
          columns={[
            { key: 'order_number', label: 'Order' },
            { key: 'name', label: 'Customer' },
            { key: 'email', label: 'Email' },
            { key: 'service_type', label: 'Service' },
            { key: 'preferred_date', label: 'Date' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'created_at', label: 'Created', render: (r) => formatDate(r.created_at) },
          ]}
        />
      )}
    </div>
  );
}
