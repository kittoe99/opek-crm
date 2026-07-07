import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { FetchError } from '../components/FetchError';
import { formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface CustomerRow {
  id: string;
  email: string;
  name: string;
  phone: string;
  bookings: number;
  contacts: number;
  prebookings: number;
  latest_at: string;
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, error, loading, setError } = useFetch(
    () => {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return api.get<{ items: CustomerRow[] }>(`/api/customers${q}`).then((d) =>
        (d.items ?? []).map((c) => ({
          ...c,
          id: c.id || c.email,
        }))
      );
    },
    [search]
  );

  const items = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="page-title">Customers</h2>
        <input
          type="search"
          placeholder="Search email, name, phone..."
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
          onRowClick={(row) => navigate(`/customers/${encodeURIComponent(row.email)}`)}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'bookings', label: 'Bookings' },
            { key: 'contacts', label: 'Contacts' },
            { key: 'prebookings', label: 'Prebookings' },
            { key: 'latest_at', label: 'Last activity', render: (r) => formatDate(r.latest_at) },
          ]}
        />
      )}
    </div>
  );
}
