import { Link } from 'react-router-dom';
import { formatDate } from '../../lib/constants';
import { DetailField, SectionCard } from './DetailSection';

export function CustomerInfoPanel({
  customer,
  showProfileLink = true,
}: {
  customer: Record<string, unknown>;
  showProfileLink?: boolean;
}) {
  const smsConsent = customer.sms_marketing_consent === true;
  const smsConsentAt =
    typeof customer.sms_marketing_consent_at === 'string'
      ? formatDate(customer.sms_marketing_consent_at)
      : null;
  const smsConsentText =
    typeof customer.sms_marketing_consent_text === 'string'
      ? customer.sms_marketing_consent_text
      : null;
  const hasSms =
    customer.sms_marketing_consent != null || smsConsentAt || smsConsentText;

  return (
    <SectionCard title="Customer">
      <dl className="space-y-1.5">
        <DetailField label="Name" value={customer.name} />
        <DetailField label="Email" value={customer.email} />
        <DetailField label="Phone" value={customer.phone} />
        {hasSms && (
          <>
            <DetailField label="SMS consent">
              {smsConsent ? (
                <span className="text-green-700">Yes</span>
              ) : (
                <span className="text-gray-400">No</span>
              )}
            </DetailField>
            {smsConsentAt && <DetailField label="Consent given" value={smsConsentAt} />}
            {smsConsentText && (
              <div className="text-sm">
                <dt className="text-gray-500">Consent text</dt>
                <dd className="mt-0.5 text-gray-500 italic">&ldquo;{smsConsentText}&rdquo;</dd>
              </div>
            )}
          </>
        )}
      </dl>
      {showProfileLink && typeof customer.email === 'string' && customer.email && (
        <Link
          to={`/customers/${encodeURIComponent(customer.email)}`}
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          View customer profile
        </Link>
      )}
    </SectionCard>
  );
}
