import { STATUS_COLORS, STATUS_LABELS } from '../lib/constants';

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
  const label = STATUS_LABELS[status] || status;
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>;
}
