import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { CLERK_ENABLED, api, getDevUserId, setDevUserId, type DevUser, type Me } from './api';
import ClerkGate from './ClerkGate';
import AbhyasiCheckin from './pages/AbhyasiCheckin';
import AbhyasiHome from './pages/AbhyasiHome';
import Community from './pages/Community';
import AdminOverview from './pages/AdminOverview';
import PreceptorAbhyasis from './pages/PreceptorAbhyasis';
import PreceptorWeek from './pages/PreceptorWeek';

const roleHome: Record<string, string> = { admin: '/admin', preceptor: '/preceptor', abhyasi: '/abhyasi' };
const navFor: Record<string, { to: string; label: string; icon: string }[]> = {
  // Preceptors are abhyasis too: their nav merges both sides (book sittings with their own preceptors).
  preceptor: [
    { to: '/preceptor', label: 'Week', icon: 'calendar' },
    { to: '/preceptor/abhyasis', label: 'Abhyasis', icon: 'users' },
    { to: '/abhyasi', label: 'Sittings', icon: 'heart' },
    { to: '/abhyasi/checkin', label: 'Check-in', icon: 'smile' },
    { to: '/community', label: 'Community', icon: 'globe' },
  ],
  abhyasi: [
    { to: '/abhyasi', label: 'Sittings', icon: 'heart' },
    { to: '/abhyasi/checkin', label: 'Check-in', icon: 'smile' },
    { to: '/community', label: 'Community', icon: 'globe' },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: 'dashboard' },
    { to: '/community', label: 'Community', icon: 'globe' },
  ],
};

// 24x24 stroke paths (lucide) for the mobile tab bar.
const tabIcons: Record<string, ReactNode> = {
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
};

export default function App() {
  // Clerk on cloud deployments; the keyless local build keeps the no-login role switcher.
  return CLERK_ENABLED ? <ClerkGate /> : <LocalApp />;
}

/** Header + role-gated routes, shared by both auth modes. */
export function Shell({ me, headerRight }: { me: Me; headerRight: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-28 md:pb-16">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 py-4">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-11 w-11 rounded-xl md:h-[72px] md:w-[72px] md:rounded-2xl" />
            <h1 className="text-base font-semibold leading-tight md:text-lg">
              Heartfulness
              <br />
              Sittings
            </h1>
          </div>
          <nav className="hidden gap-1 text-sm md:flex" aria-label="Pages">
            {navFor[me.role].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${isActive ? 'bg-emerald-100 text-emerald-900' : 'text-stone-600 hover:bg-stone-100'}`
                }
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {tabIcons[l.icon]}
                </svg>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {headerRight}
      </header>

      {/* Mobile: bottom tab bar replaces the top nav. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-stone-200 bg-white pt-1.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.05)] md:hidden"
        aria-label="Pages"
      >
        {navFor[me.role].map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 text-[11px] ${isActive ? 'font-semibold text-emerald-800' : 'font-medium text-stone-500'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-[30px] w-[52px] items-center justify-center rounded-full ${isActive ? 'bg-emerald-100' : ''}`}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {tabIcons[l.icon]}
                  </svg>
                </span>
                {l.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to={roleHome[me.role]} replace />} />
        <Route path="/preceptor" element={me.role === 'preceptor' ? <PreceptorWeek /> : <Navigate to="/" replace />} />
        <Route path="/preceptor/abhyasis" element={me.role === 'preceptor' ? <PreceptorAbhyasis /> : <Navigate to="/" replace />} />
        <Route path="/abhyasi" element={me.role !== 'admin' ? <AbhyasiHome /> : <Navigate to="/" replace />} />
        <Route path="/abhyasi/checkin" element={me.role !== 'admin' ? <AbhyasiCheckin /> : <Navigate to="/" replace />} />
        <Route path="/community" element={<Community />} />
        <Route path="/admin" element={me.role === 'admin' ? <AdminOverview /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function LocalApp() {
  const queryClient = useQueryClient();
  const devUsers = useQuery({ queryKey: ['devUsers'], queryFn: () => api<DevUser[]>('/api/dev/users') });
  const me = useQuery({
    queryKey: ['me', getDevUserId()],
    queryFn: () => api<Me>('/api/me'),
    enabled: !!getDevUserId(),
  });

  // First visit (nobody selected), or a stale selection after a db re-seed:
  // pick the first preceptor automatically.
  const stored = getDevUserId();
  if (devUsers.data && (!stored || !devUsers.data.some((u) => u.id === stored))) {
    const first = devUsers.data.find((u) => u.role === 'preceptor') ?? devUsers.data[0];
    if (first) {
      setDevUserId(first.id);
      queryClient.clear();
      window.location.assign('/');
    }
  }

  const switchUser = (id: string) => {
    setDevUserId(id);
    queryClient.clear();
    const u = devUsers.data?.find((x) => x.id === id);
    window.location.assign(u ? roleHome[u.role] : '/');
  };

  const switcher = (
    <label className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm">
      <span className="font-medium text-amber-800">Acting as</span>
      <select className="bg-transparent font-semibold outline-none" value={getDevUserId() ?? ''} onChange={(e) => switchUser(e.target.value)}>
        {devUsers.data?.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {u.role}
          </option>
        ))}
      </select>
    </label>
  );

  // Keep the switcher visible on errors (e.g. acting as a deactivated user), so you can switch away.
  if (me.isError)
    return (
      <div className="space-y-4 p-6">
        <div className="flex justify-end">{switcher}</div>
        <p className="text-red-600">{me.error instanceof Error ? me.error.message : 'Could not load user — is the API running?'}</p>
      </div>
    );
  if (!me.data) return null;
  return <Shell me={me.data} headerRight={switcher} />;
}
