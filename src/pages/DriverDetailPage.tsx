import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FetchError } from '../components/FetchError';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface DriverData {
  driver: Record<string, unknown>;
  states: string[];
}

const DRIVER_STATUSES = ['pending', 'approved', 'suspended'];

export function DriverDetailPage() {
  const { id = '' } = useParams();
  const [status, setStatus] = useState('pending');
  const [statesText, setStatesText] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const { data, error, loading, setError, reload } = useFetch(
    () => api.get<DriverData>(`/api/drivers?id=${id}`),
    [id],
    { enabled: !!id }
  );

  useEffect(() => {
    if (data) {
      setStatus(String(data.driver.status));
      setStatesText(data.states.join(', '));
      setFullName(String(data.driver.full_name || ''));
      setPhone(String(data.driver.phone || ''));
    }
  }, [data]);

  const save = async () => {
    setBusy('save');
    setMessage('');
    try {
      await api.patch(`/api/drivers?id=${id}`, {
        status,
        full_name: fullName,
        phone,
        states: statesText,
      });
      setMessage('Driver updated');
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy('');
    }
  };

  if (loading && !data) return <p className="text-gray-500">Loading...</p>;
  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return null;

  const driver = data.driver;
  const providerSignupId = driver.provider_signup_id as string | null;
  const accountLinked = Boolean(driver.user_id);

  return (
    <div>
      <FetchError message={error} onDismiss={() => setError('')} />
      <Link to="/drivers" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-800">
        ← Back to drivers
      </Link>

      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold">{String(driver.full_name || driver.email)}</h2>
        <StatusBadge status={String(driver.status)} />
      </div>

      {!accountLinked && (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No driver app account linked yet. The driver must sign in to the driver app with{' '}
          <strong>{String(driver.email)}</strong> before they can accept job offers.
        </p>
      )}

      {message && (
        <p
          className={`mb-4 rounded px-3 py-2 text-sm ${
            message.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-semibold">Profile</h3>
          <p className="text-sm text-gray-600">{String(driver.email)}</p>
          <p className="text-sm text-gray-600">{String(driver.vehicle_type || '—')}</p>
          <p className="text-sm text-gray-500">Created {formatDate(String(driver.created_at))}</p>
          {providerSignupId && (
            <Link
              to={`/records/providers`}
              className="mt-2 inline-block text-sm text-blue-600 hover:underline"
            >
              Linked provider signup
            </Link>
          )}
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Manage driver</h3>
          <label className="mb-1 block text-xs font-medium text-gray-600">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mb-3 w-full"
          />
          <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mb-3 w-full"
          />
          <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mb-3 w-full">
            {DRIVER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Service states (comma-separated, e.g. CA, NV)
          </label>
          <input
            type="text"
            value={statesText}
            onChange={(e) => setStatesText(e.target.value)}
            placeholder="CA, NV, AZ"
            className="mb-3 w-full"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy === 'save'}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
