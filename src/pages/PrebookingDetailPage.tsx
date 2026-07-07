import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookingDetailsPanel } from '../components/detail/BookingDetailsPanel';
import { CustomerInfoPanel } from '../components/detail/CustomerInfoPanel';
import { SectionCard } from '../components/detail/DetailSection';
import { LocationInfoPanel } from '../components/detail/LocationInfoPanel';
import { FetchError } from '../components/FetchError';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

const PREBOOKING_STATUSES = [
  'partially_submitted',
  'pending',
  'reviewed',
  'contacted',
  'scheduled',
  'converted',
  'archived',
];

interface PrebookingData {
  prebooking: Record<string, unknown>;
}

export function PrebookingDetailPage() {
  const { id = '' } = useParams();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const { data, error, loading, setError, reload } = useFetch(
    () => api.get<PrebookingData>(`/api/prebookings?id=${id}`),
    [id],
    { enabled: !!id }
  );

  useEffect(() => {
    if (data) setStatus(String(data.prebooking.status));
  }, [data]);

  const updateStatus = async () => {
    setBusy('status');
    setMessage('');
    try {
      await api.patch(`/api/prebookings?id=${id}`, { status, note });
      setMessage('Status updated');
      setNote('');
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy('');
    }
  };

  const sendEmail = async (action: string, body: unknown) => {
    setBusy(action);
    setMessage('');
    try {
      await api.post(`/api/emails/${action}`, body);
      setMessage(`Email sent (${action})`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Email failed');
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <p className="text-gray-500">Loading...</p>;
  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return null;

  const prebooking = data.prebooking;
  const customer = (prebooking.customer_info as Record<string, unknown>) || {};
  const location = (prebooking.location_info as Record<string, unknown>) || {};
  const details = (prebooking.booking_details as Record<string, unknown>) || {};
  const createdAt = formatDate(prebooking.created_at as string);

  return (
    <div>
      <FetchError message={error} onDismiss={() => setError('')} />
      <Link
        to="/prebookings"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-800"
      >
        ← Back to prebookings
      </Link>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold">Prebooking</h2>
        <StatusBadge status={String(prebooking.status)} />
        <span className="text-sm text-gray-400">{createdAt}</span>
      </div>

      {message && (
        <p
          className={`mb-4 rounded px-3 py-2 text-sm ${
            message.includes('failed') || message.includes('Error')
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <CustomerInfoPanel customer={customer} />
          {Object.keys(location).length > 0 && <LocationInfoPanel location={location} />}
        </div>

        <div className="space-y-4">
          <SectionCard title="Update status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mb-2 w-full"
            >
              {PREBOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mb-2 w-full"
            />
            <button
              type="button"
              onClick={updateStatus}
              disabled={busy === 'status'}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Save status
            </button>
          </SectionCard>

          <SectionCard title="Email actions">
            <ActionBtn
              label="Form notification"
              busy={busy === 'form-notification'}
              onClick={() =>
                sendEmail('form-notification', {
                  recordType: 'prebookings',
                  recordId: id,
                })
              }
            />
          </SectionCard>
        </div>
      </div>

      <BookingDetailsPanel details={details} />
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  busy,
}: {
  label: string;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {busy ? 'Sending...' : label}
    </button>
  );
}
