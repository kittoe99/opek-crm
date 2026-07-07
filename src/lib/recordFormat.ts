export function formatDollars(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseItemString(raw: unknown): { name: string; quantity?: number } {
  if (typeof raw !== 'string') return { name: String(raw) };
  const match = raw.match(/^(\d+)x\s+(.+)$/i);
  if (match) {
    return { name: match[2], quantity: parseInt(match[1], 10) };
  }
  return { name: raw };
}

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

export function formatRecordValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (isIsoDateString(value)) {
      return new Date(value).toLocaleString();
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
  }
  return JSON.stringify(value);
}

export const KNOWN_RECORD_SECTIONS = [
  'customer_info',
  'location_info',
  'booking_details',
  'contact_info',
  'provider_info',
  'visit_info',
  'estimate_info',
] as const;

export const KNOWN_RECORD_META = ['id', 'status', 'created_at', 'updated_at', 'order_number'] as const;
