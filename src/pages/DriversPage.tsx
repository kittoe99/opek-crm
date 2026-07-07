import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { FetchError } from '../components/FetchError';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface DriverRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  states: string[];
  created_at: string;
}

export function DriversPage() {
  const navigate = useNavigate();
  const { data, error, loading, setError } = useFetch(
    () => api.get<{ items: DriverRow[] }>('/api/drivers').then((d) => d.items ?? []),
    []
  );

  const items = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="page-title">Drivers</h2>
      </div>
      <FetchError message={error} onDismiss={() => setError('')} />

      {loading && items.length === 0 ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <DataTable
          rows={items}
          onRowClick={(row) => navigate(`/drivers/${row.id}`)}
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            {
              key: 'states',
              label: 'States',
              render: (r) => (r.states?.length ? r.states.join(', ') : '—'),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <StatusBadge status={r.status} />,
            },
            { key: 'created_at', label: 'Created', render: (r) => formatDate(r.created_at) },
          ]}
        />
      )}
    </div>
  );
}
