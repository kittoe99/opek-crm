import { formatDate } from '../lib/constants';
import { KNOWN_RECORD_META, KNOWN_RECORD_SECTIONS } from '../lib/recordFormat';
import { StatusBadge } from './StatusBadge';
import { BookingDetailsPanel } from './detail/BookingDetailsPanel';
import { CustomerInfoPanel } from './detail/CustomerInfoPanel';
import { DetailFields, SectionCard } from './detail/DetailSection';
import { LocationInfoPanel } from './detail/LocationInfoPanel';

const SECTION_TITLES: Record<string, string> = {
  contact_info: 'Contact message',
  provider_info: 'Provider details',
  visit_info: 'Visit details',
  estimate_info: 'Estimate details',
};

const SECTION_LABELS: Record<string, Record<string, string>> = {
  contact_info: { message: 'Message', subject: 'Subject' },
  provider_info: {
    service_area: 'Service area',
    vehicle_type: 'Vehicle type',
    experience: 'Experience',
    availability: 'Availability',
    notes: 'Notes',
  },
  visit_info: {
    preferred_date: 'Preferred date',
    preferred_time: 'Preferred time',
    service_type: 'Service type',
    notes: 'Notes',
  },
  estimate_info: {
    preferred_date: 'Preferred date',
    preferred_time: 'Preferred time',
    address: 'Address',
    notes: 'Notes',
    estimate_amount: 'Estimate amount',
  },
};

interface RecordDetailViewProps {
  record: Record<string, unknown>;
  recordType?: string;
  compact?: boolean;
  showCustomer?: boolean;
}

export function RecordDetailView({
  record,
  recordType,
  compact = false,
  showCustomer = true,
}: RecordDetailViewProps) {
  const customer = (record.customer_info as Record<string, unknown>) || null;
  const location = (record.location_info as Record<string, unknown>) || null;
  const bookingDetails = (record.booking_details as Record<string, unknown>) || null;

  const extraSections = KNOWN_RECORD_SECTIONS.filter((key) => {
    if (key === 'customer_info' || key === 'location_info' || key === 'booking_details') return false;
    const value = record[key];
    return value != null && typeof value === 'object' && Object.keys(value as object).length > 0;
  });

  const extraMeta = Object.entries(record).filter(([key, value]) => {
    if (KNOWN_RECORD_META.includes(key as (typeof KNOWN_RECORD_META)[number])) return false;
    if (KNOWN_RECORD_SECTIONS.includes(key as (typeof KNOWN_RECORD_SECTIONS)[number])) return false;
    return value != null && value !== '' && typeof value !== 'object';
  });

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
          {record.status != null && <StatusBadge status={String(record.status)} />}
          {record.created_at != null && (
            <span className="text-xs text-gray-400">{formatDate(String(record.created_at))}</span>
          )}
          {record.order_number != null && (
            <span className="text-xs font-medium text-gray-600">#{String(record.order_number)}</span>
          )}
          {recordType && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{recordType}</span>
          )}
        </div>
      )}

      <div className={`grid gap-4 ${compact ? '' : 'md:grid-cols-2'}`}>
        {showCustomer && customer && Object.keys(customer).length > 0 && (
          <CustomerInfoPanel customer={customer} showProfileLink={!compact} />
        )}

        {location && Object.keys(location).length > 0 && <LocationInfoPanel location={location} />}

        {extraSections.map((key) => (
          <SectionCard key={key} title={SECTION_TITLES[key] || key.replace(/_/g, ' ')}>
            <DetailFields
              data={record[key] as Record<string, unknown>}
              labels={SECTION_LABELS[key]}
            />
          </SectionCard>
        ))}

        {extraMeta.length > 0 && (
          <SectionCard title="Additional info">
            <DetailFields
              data={Object.fromEntries(extraMeta)}
              labels={Object.fromEntries(extraMeta.map(([k]) => [k, k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())]))}
            />
          </SectionCard>
        )}
      </div>

      {bookingDetails && Object.keys(bookingDetails).length > 0 && (
        <BookingDetailsPanel details={bookingDetails} />
      )}
    </div>
  );
}
