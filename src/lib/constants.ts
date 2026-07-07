export const ASSIGNMENT_STATUSES = ['offered', 'accepted', 'declined', 'cancelled', 'completed'] as const;

export const DRIVER_STATUSES = ['pending', 'approved', 'suspended'] as const;

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'scheduled',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  en_route: 'En Route',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  partially_submitted: 'Partial',
  offered: 'Offered',
  accepted: 'Accepted',
  declined: 'Declined',
  approved: 'Approved',
  suspended: 'Suspended',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-indigo-100 text-indigo-800',
  en_route: 'bg-orange-100 text-orange-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  partially_submitted: 'bg-gray-100 text-gray-800',
  offered: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  approved: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export const RECORD_TYPE_LABELS: Record<string, string> = {
  contacts: 'Contacts',
  prebookings: 'Prebookings',
  providers: 'Provider Signups',
  visits: 'Schedule Visits',
  estimates: 'In-Home Estimates',
};
