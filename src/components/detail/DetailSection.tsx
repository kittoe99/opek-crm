import type { ReactNode } from 'react';
import { formatRecordValue } from '../../lib/recordFormat';

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

export function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value?: unknown;
  children?: ReactNode;
}) {
  const display =
    children ??
    (value != null && value !== '' ? (
      formatRecordValue(value)
    ) : (
      <span className="text-gray-300">—</span>
    ));

  if (!children && (value == null || value === '')) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <dt className="w-36 shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 text-gray-900">{display}</dd>
    </div>
  );
}

export function DetailFields({ data, labels }: { data: Record<string, unknown>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">No details</p>;
  }

  return (
    <dl className="space-y-1.5">
      {entries.map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return null;
        }
        return (
          <DetailField
            key={key}
            label={labels?.[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            value={value}
          />
        );
      })}
    </dl>
  );
}
