import { formatDollars, parseItemString } from '../../lib/recordFormat';
import { SectionCard } from './DetailSection';

export function BookingDetailsPanel({ details }: { details: Record<string, unknown> }) {
  const rawItems = Array.isArray(details.estimated_items) ? details.estimated_items : [];
  const estimatedItems = rawItems.map(parseItemString);
  const hasItems = estimatedItems.length > 0;

  const hasDetails =
    typeof details.service_type === 'string' ||
    details.price != null ||
    details.preferred_date != null ||
    details.preferred_time != null ||
    details.estimated_volume != null ||
    hasItems ||
    typeof details.details === 'string' ||
    typeof details.photo_url === 'string' ||
    details.online_booking_discount != null ||
    typeof details.zip_code === 'string' ||
    details.deposit_paid != null ||
    typeof details.estimate_summary === 'string';

  if (!hasDetails) return null;

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">Service</h3>
            <p className="mt-0.5 text-lg font-semibold text-gray-900">
              {String(details.service_type || '—')}
            </p>
          </div>
          {details.price != null && (
            <div className="text-right">
              <h3 className="text-xs font-medium uppercase tracking-wide text-gray-400">Price</h3>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">
                {typeof details.price === 'number'
                  ? formatDollars(details.price)
                  : String(details.price)}
              </p>
            </div>
          )}
        </div>

        <hr className="mb-4 border-gray-100" />

        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Schedule & details</h3>
        <div className="mb-4 flex flex-wrap gap-3">
          {(details.preferred_date != null || details.preferred_time != null) && (
            <>
              <StatChip label="Date" value={String(details.preferred_date || '—')} />
              <StatChip label="Time" value={String(details.preferred_time || '—')} />
            </>
          )}
          {details.estimated_volume != null && (
            <StatChip label="Volume" value={String(details.estimated_volume)} />
          )}
          {typeof details.zip_code === 'string' && details.zip_code && (
            <StatChip label="ZIP" value={details.zip_code} />
          )}
          {details.deposit_paid != null && (
            <StatChip
              label="Deposit paid"
              value={details.deposit_paid === true ? 'Yes' : 'No'}
              highlight={details.deposit_paid === true}
            />
          )}
          {details.online_booking_discount != null && (
            <StatChip
              label="Discount"
              value={`−${formatDollars(Number(details.online_booking_discount))}`}
              highlight
            />
          )}
        </div>

        {hasItems && (
          <>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Items</h3>
            <ul className="mb-4 grid gap-2 sm:grid-cols-2">
              {estimatedItems.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  {item.quantity != null && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      ×{item.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {details.details != null && details.details !== '' && (
          <>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Notes</h3>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="whitespace-pre-line text-sm text-gray-600">{String(details.details)}</p>
            </div>
          </>
        )}
      </div>

      {details.estimate_summary != null && details.estimate_summary !== '' && (
        <SectionCard title="Estimate summary">
          <p className="whitespace-pre-line text-sm text-gray-700">{String(details.estimate_summary)}</p>
        </SectionCard>
      )}

      {typeof details.photo_url === 'string' && details.photo_url && (
        <SectionCard title="Uploaded photo">
          <a
            href={details.photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View image
          </a>
        </SectionCard>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight ? 'border-blue-100 bg-blue-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <span className={`text-xs ${highlight ? 'text-blue-500' : 'text-gray-400'}`}>{label}</span>
      <p className={`text-sm font-medium ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
