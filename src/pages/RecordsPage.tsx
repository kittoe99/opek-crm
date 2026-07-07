import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { FetchError } from '../components/FetchError';
import { RecordDetailView } from '../components/RecordDetailView';
import { StatusBadge } from '../components/StatusBadge';
import { RECORD_TYPE_LABELS, formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface RecordRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  status?: string;
  created_at: string;
  raw: Record<string, unknown>;
}

const EMAIL_ACTIONS: Record<string, { recordType: string; confirmationType?: string }> = {
  contacts: { recordType: 'contacts', confirmationType: 'contact' },
  prebookings: { recordType: 'prebookings' },
  providers: { recordType: 'providers', confirmationType: 'provider_signup' },
  visits: { recordType: 'visits' },
  estimates: { recordType: 'estimates' },
};

export function RecordsPage() {
  const { type = 'contacts' } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const { data, error, loading, setError } = useFetch(
    () => api.get<{ items: RecordRow[] }>(`/api/records?type=${type}`).then((d) => d.items ?? []),
    [type]
  );

  useEffect(() => {
    setSelected(null);
  }, [type]);

  const items = data ?? [];

  const sendEmail = async (action: string, body: unknown) => {
    setBusy(action);
    setMessage('');
    try {
      await api.post(`/api/emails/${action}`, body);
      setMessage('Email sent');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy('');
    }
  };

  const actions = EMAIL_ACTIONS[type];

  const createDriverFromProvider = async () => {
    if (!selected || type !== 'providers') return;
    setBusy('create-driver');
    setMessage('');
    try {
      const res = await api.post<{ driver: { id: string } }>('/api/drivers', {
        provider_signup_id: selected.id,
      });
      setMessage('Driver profile created');
      navigate(`/drivers/${res.driver.id}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create driver');
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <h2 className="page-title mb-4">{RECORD_TYPE_LABELS[type] || type}</h2>
      <FetchError message={error} onDismiss={() => setError('')} />
      {message && <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

      {loading && items.length === 0 ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <DataTable
            rows={items}
            onRowClick={setSelected}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              ...(items.some((i) => i.status)
                ? [{ key: 'status', label: 'Status', render: (r: RecordRow) => (r.status ? <StatusBadge status={r.status} /> : '—') }]
                : []),
              { key: 'created_at', label: 'Created', render: (r) => formatDate(r.created_at) },
            ]}
          />

          {selected && (
            <div className="card p-4">
              <h3 className="mb-3 font-semibold">Record detail</h3>
              {type === 'prebookings' && (
                <Link
                  to={`/prebookings/${selected.id}`}
                  className="mb-3 inline-block text-sm text-blue-600 hover:underline"
                >
                  Open full prebooking page →
                </Link>
              )}
              <RecordDetailView record={selected.raw} recordType={RECORD_TYPE_LABELS[type] || type} />
              {actions && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() =>
                      sendEmail('form-notification', {
                        recordType: actions.recordType,
                        recordId: selected.id,
                      })
                    }
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    Send form notification
                  </button>
                  {actions.confirmationType && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        sendEmail('confirmation', {
                          type: actions.confirmationType,
                          recordId: selected.id,
                        })
                      }
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      Send confirmation
                    </button>
                  )}
                  {type === 'providers' && (
                    <button
                      type="button"
                      disabled={busy === 'create-driver'}
                      onClick={createDriverFromProvider}
                      className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      Create driver profile
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
