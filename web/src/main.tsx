import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Clerk wraps the tree only when the build carries a publishable key (cloud deployments).
// Local keyless builds run the no-login role switcher instead.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const withAuth = (children: ReactNode) =>
  clerkKey ? (
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  ) : (
    children
  );

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {withAuth(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>,
    )}
  </StrictMode>,
);
