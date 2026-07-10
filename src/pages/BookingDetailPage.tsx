import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FetchError } from '../components/FetchError';
import { BookingDetailsPanel } from '../components/detail/BookingDetailsPanel';
import { CustomerInfoPanel } from '../components/detail/CustomerInfoPanel';
import { LocationInfoPanel } from '../components/detail/LocationInfoPanel';
import { StatusBadge } from '../components/StatusBadge';
import { BOOKING_STATUSES, formatCents, formatDate } from '../lib/constants';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';

interface AssignmentRow {
  id: string;
  status: string;
  assigned_at: string;
  responded_at: string | null;
  note: string | null;
  drivers: { id: string; full_name: string; email: string; phone: string; status: string } | null;
}

interface DriverOption {
  id: string;
  full_name: string;
  email: string;
  states: string[];
  status: string;
}

interface BookingDetail {
  booking: Record<string, unknown>;
  payments: Array<Record<string, unknown>>;
  history: Array<{ id: string; status: string; note: string | null; created_at: string }>;
  assignments: AssignmentRow[];
}

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [enforceState, setEnforceState] = useState(true);

  const { data, error, loading, setError, reload } = useFetch(
    () => api.get<BookingDetail>(`/api/bookings?id=${id}`),
    [id],
    { enabled: !!id }
  );

  useEffect(() => {
    if (data) setStatus(String(data.booking.status));
  }, [data]);

  useEffect(() => {
    api
      .get<{ items: DriverOption[] }>('/api/drivers?status=approved')
      .then((d) => setDrivers(d.items ?? []))
      .catch(() => setDrivers([]));
  }, []);

  const updateStatus = async () => {
    setBusy('status');
    setMessage('');
    try {
      await api.patch(`/api/bookings?id=${id}`, { status, note });
      setMessage('Status updated');
      setNote('');
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy('');
    }
  };

  const assignJob = async () => {
    if (!selectedDriverId) return;
    setBusy('assign');
    setMessage('');
    try {
      await api.post('/api/assignments', {
        booking_id: id,
        driver_id: selectedDriverId,
        note: assignNote || undefined,
        enforce_state: enforceState,
      });
      setMessage('Job offered to driver');
      setAssignNote('');
      setSelectedDriverId('');
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Assignment failed');
    } finally {
      setBusy('');
    }
  };

  const cancelAssignment = async (assignmentId: string) => {
    setBusy(`cancel-${assignmentId}`);
    setMessage('');
    try {
      await api.patch(`/api/assignments?id=${assignmentId}`, { action: 'cancel' });
      setMessage('Assignment cancelled');
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Cancel failed');
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

  const booking = data.booking;
  const customer = (booking.customer_info as Record<string, unknown>) || {};
  const location = (booking.location_info as Record<string, unknown>) || {};
  const bookingDetails = (booking.booking_details as Record<string, unknown>) || {};
  const bookingState = String(location.state || '').toUpperCase();
  const activeAssignment = data.assignments.find((a) => a.status === 'offered' || a.status === 'accepted');
  const eligibleDrivers = drivers.filter(
    (d) => !bookingState || d.states.includes(bookingState)
  );
  // Always list every approved driver. Matching service areas first, then others
  // (so missing/outdated service-area rows don't hide assignable haulers).
  const assignableDrivers = [...drivers].sort((a, b) => {
    const aMatch = bookingState ? Number(a.states.includes(bookingState)) : 1;
    const bMatch = bookingState ? Number(b.states.includes(bookingState)) : 1;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return a.full_name.localeCompare(b.full_name);
  });
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
  const selectedOutOfArea =
    !!bookingState &&
    !!selectedDriver &&
    !selectedDriver.states.includes(bookingState);

  return (
    <div>
      <FetchError message={error} onDismiss={() => setError('')} />
      <Link to="/bookings" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-800">
        ← Back to bookings
      </Link>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold">{String(booking.order_number)}</h2>
        <StatusBadge status={String(booking.status)} />
      </div>

      {message && (
        <p
          className={`mb-4 rounded px-3 py-2 text-sm ${
            message.includes('failed') || message.includes('Error') || message.includes('does not')
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mb-6 rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Driver assignment</h3>
        {typeof location.city === 'string' && location.city && (
          <p className="mb-3 text-sm text-gray-600">
            Job location: {location.city}, {String(location.state || '—')} {String(location.zip_code || '')}
          </p>
        )}

        {activeAssignment ? (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={activeAssignment.status} />
              <span className="text-sm font-medium">
                {activeAssignment.drivers?.full_name || 'Unknown driver'}
              </span>
              <span className="text-xs text-gray-500">
                offered {formatDate(activeAssignment.assigned_at)}
              </span>
              {activeAssignment.drivers?.id && (
                <Link
                  to={`/drivers/${activeAssignment.drivers.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  View driver
                </Link>
              )}
            </div>
            {activeAssignment.note && (
              <p className="mt-1 text-xs text-gray-600">{activeAssignment.note}</p>
            )}
            {(activeAssignment.status === 'offered' || activeAssignment.status === 'accepted') && (
              <button
                type="button"
                onClick={() => cancelAssignment(activeAssignment.id)}
                disabled={busy === `cancel-${activeAssignment.id}`}
                className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Cancel assignment
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">No active assignment. Offer this job to an approved driver.</p>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full max-w-md"
            >
              <option value="">Select driver…</option>
              {assignableDrivers.map((d) => {
                const inArea = !bookingState || d.states.includes(bookingState);
                const statesLabel = d.states.join(', ') || 'no states';
                return (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.email}) — {statesLabel}
                    {!inArea && bookingState ? ` · outside ${bookingState}` : ''}
                  </option>
                );
              })}
            </select>
            {bookingState && eligibleDrivers.length === 0 && (
              <p className="text-xs text-amber-700">
                No approved drivers cover {bookingState} yet. You can still assign someone below — uncheck
                “Enforce state geofence” if needed, or add states on the driver profile.
              </p>
            )}
            {selectedOutOfArea && (
              <p className="text-xs text-amber-700">
                Selected driver is outside {bookingState}. Uncheck “Enforce state geofence” to assign anyway.
              </p>
            )}
            <input
              type="text"
              placeholder="Note for driver (optional)"
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              className="w-full max-w-md"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={enforceState}
                onChange={(e) => setEnforceState(e.target.checked)}
              />
              Enforce state geofence
            </label>
            <button
              type="button"
              onClick={assignJob}
              disabled={!selectedDriverId || busy === 'assign'}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Offer job to driver
            </button>
          </div>
        )}

        {data.assignments.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">History</p>
            <ul className="space-y-1 text-sm">
              {data.assignments.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <span>{a.drivers?.full_name || '—'}</span>
                  <span className="text-xs text-gray-400">{formatDate(a.assigned_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <CustomerInfoPanel customer={customer} />
        <div className="rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-semibold">Update status</h3>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mb-2 w-full"
          >
            {BOOKING_STATUSES.map((s) => (
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
        </div>
      </div>

      <div className="mb-6 rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Email actions</h3>
        <div className="flex flex-wrap gap-2">
          <ActionBtn
            label="Form notification"
            busy={busy === 'form-notification'}
            onClick={() => sendEmail('form-notification', { recordType: 'bookings', recordId: id })}
          />
          <ActionBtn
            label="Confirmation email"
            busy={busy === 'confirmation'}
            onClick={() => sendEmail('confirmation', { type: 'booking', recordId: id })}
          />
          <ActionBtn
            label="Appointment reminder"
            busy={busy === 'reminder'}
            onClick={() => sendEmail('reminder', { bookingId: id })}
          />
        </div>
      </div>

      {data.history.length > 0 && (
        <div className="mb-6 rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Status history</h3>
          <ul className="space-y-2">
            {data.history.map((h) => (
              <li key={h.id} className="text-sm">
                <StatusBadge status={h.status} /> {formatDate(h.created_at)}
                {h.note && <span className="text-gray-500"> — {h.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.payments.length > 0 && (
        <div className="mb-6 rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Payments</h3>
          <ul className="space-y-2">
            {data.payments.map((p) => (
              <li key={String(p.id)} className="flex items-center gap-3 text-sm">
                <span>
                  {formatCents(p.amount_cents as number)} — {String(p.status)}
                  {p.receipt_sent_at ? ' (receipt sent)' : ''}
                </span>
                <button
                  type="button"
                  disabled={busy === `receipt-${p.id}`}
                  onClick={() => {
                    setBusy(`receipt-${p.id}`);
                    sendEmail('receipt', { paymentId: p.id }).finally(() => setBusy(''));
                  }}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50"
                >
                  Resend receipt
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <LocationInfoPanel location={location} />
      </div>
      <div className="mt-4">
        <BookingDetailsPanel details={bookingDetails} />
      </div>
    </div>
  );
}

function ActionBtn({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
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
