import { DetailField, SectionCard } from './DetailSection';

export function LocationInfoPanel({ location }: { location: Record<string, unknown> }) {
  const address = [location.address, location.unit_number].filter(Boolean).join(', ');
  const cityLine = [location.city, location.state, location.zip_code].filter(Boolean).join(', ');

  const hasData =
    address ||
    cityLine ||
    location.instructions ||
    location.access_notes ||
    location.parking_notes;

  if (!hasData) return null;

  return (
    <SectionCard title="Location">
      <dl className="space-y-1.5">
        {address && <DetailField label="Address" value={address} />}
        {cityLine && <DetailField label="City / State / ZIP" value={cityLine} />}
        <DetailField label="Instructions" value={location.instructions} />
        <DetailField label="Access notes" value={location.access_notes} />
        <DetailField label="Parking" value={location.parking_notes} />
      </dl>
    </SectionCard>
  );
}
