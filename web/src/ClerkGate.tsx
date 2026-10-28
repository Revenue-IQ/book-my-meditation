// Clerk-mode shell (Phase 4): sign-in wall, token wiring for the api client, and the
// "no account" screen for sign-ins that no invitation created. Rendered only when the
// build has VITE_CLERK_PUBLISHABLE_KEY; local dev never reaches this file.
import { SignIn, SignOutButton, SignUp, SignedIn, SignedOut, UserButton, useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { Shell } from './App';
import { api, setAuthTokenGetter, type Me } from './api';

export default function ClerkGate() {
  return (
    <>
      <SignedOut>
        <Welcome>
          <Routes>
            {/* Invitation emails land on /sign-up with a __clerk_ticket, which <SignUp> consumes. */}
            <Route path="/sign-up" element={<SignUp routing="hash" signInUrl="/" />} />
            <Route path="*" element={<SignIn routing="hash" signUpUrl="/sign-up" />} />
          </Routes>
        </Welcome>
      </SignedOut>
      <SignedIn>
        <Authed />
      </SignedIn>
    </>
  );
}

function Welcome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="" className="h-24 w-24 rounded-3xl" />
        <h1 className="text-xl font-semibold">Heartfulness Sittings</h1>
      </div>
      {children}
    </div>
  );
}

function Authed() {
  const { getToken } = useAuth();
  // Module-level registration so the plain api() helper can attach fresh session tokens.
  setAuthTokenGetter(() => getToken());

  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/me'), retry: false });

  if (me.isError)
    return (
      <Welcome>
        <p className="max-w-md text-center text-stone-700">{me.error.message}</p>
        <SignOutButton>
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">Sign out</button>
        </SignOutButton>
      </Welcome>
    );
  if (!me.data) return null;
  return (
    <Shell
      me={me.data}
      headerRight={
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-600">
            {me.data.name} <span className="text-stone-400">· {me.data.role}</span>
          </span>
          <UserButton />
        </div>
      }
    />
  );
}
