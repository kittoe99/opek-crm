import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const MAIN_NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/bookings', label: 'Bookings' },
  { to: '/prebookings', label: 'Prebookings' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/customers', label: 'Customers' },
  { to: '/payments', label: 'Payments' },
];

const RECORDS_NAV = [
  { to: '/records/contacts', label: 'Contacts' },
  { to: '/records/providers', label: 'Providers' },
  { to: '/records/visits', label: 'Visits' },
  { to: '/records/estimates', label: 'Estimates' },
];

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

function NavLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  const active = isActive(pathname, to);

  return (
    <Link
      to={to}
      className={`block rounded-md px-2.5 py-1.5 text-sm ${
        active ? 'bg-gray-900 font-medium text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {label}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r border-gray-200 bg-white">
        <div className="sticky top-0 flex h-screen flex-col p-4">
          <div className="mb-6 border-b border-gray-100 pb-4">
            <h1 className="text-base font-semibold tracking-tight">Opek CRM</h1>
            <p className="mt-0.5 truncate text-xs text-gray-500">{user?.email}</p>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-0.5">
              {MAIN_NAV.map((item) => <NavLink key={item.to} {...item} />)}
            </div>
            <div>
              <p className="mb-1.5 px-2.5 text-xs font-medium uppercase tracking-wide text-gray-400">Records</p>
              <div className="space-y-0.5">
                {RECORDS_NAV.map((item) => <NavLink key={item.to} {...item} />)}
              </div>
            </div>
          </nav>

          <button
            type="button"
            onClick={() => signOut()}
            className="mt-4 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
