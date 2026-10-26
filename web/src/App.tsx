import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flower2 } from 'lucide-react';
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
const navFor: Record<string, { to: string; label: string }[]> = {
  preceptor: [
    { to: '/preceptor', label: 'This week' },
    { to: '/preceptor/abhyasis', label: 'My Abhyasis' },
    { to: '/community', label: 'Community' },
  ],
  abhyasi: [
    { to: '/abhyasi', label: 'Sittings' },
    { to: '/abhyasi/checkin', label: 'Check-in' },
    { to: '/community', label: 'Community' },
  ],
  admin: [
    { to: '/admin', label: 'Overview' },
    { to: '/community', label: 'Community' },
  ],
};

export default function App() {
  // Clerk on cloud deployments; the keyless local build keeps the no-login role switcher.
  return CLERK_ENABLED ? <ClerkGate /> : <LocalApp />;
}

/** Header + role-gated routes, shared by both auth modes. */
export function Shell({ me, headerRight }: { me: Me; headerRight: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 py-4">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Flower2 className="h-6 w-6 text-emerald-700" />
            <h1 className="text-lg font-semibold">Heartfulness Sittings</h1>
          </div>
          <nav className="flex gap-1 text-sm" aria-label="Pages">
            {navFor[me.role].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 font-medium ${isActive ? 'bg-emerald-100 text-emerald-900' : 'text-stone-600 hover:bg-stone-100'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {headerRight}
      </header>

      <Routes>
        <Route path="/" element={<Navigate to={roleHome[me.role]} replace />} />
        <Route path="/preceptor" element={me.role === 'preceptor' ? <PreceptorWeek /> : <Navigate to="/" replace />} />
        <Route path="/preceptor/abhyasis" element={me.role === 'preceptor' ? <PreceptorAbhyasis /> : <Navigate to="/" replace />} />
        <Route path="/abhyasi" element={me.role === 'abhyasi' ? <AbhyasiHome /> : <Navigate to="/" replace />} />
        <Route path="/abhyasi/checkin" element={me.role === 'abhyasi' ? <AbhyasiCheckin /> : <Navigate to="/" replace />} />
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

  if (me.isError)
    return <p className="p-6 text-red-600">Could not load user — is the API running?</p>;
  if (!me.data) return null;
  return <Shell me={me.data} headerRight={switcher} />;
}
