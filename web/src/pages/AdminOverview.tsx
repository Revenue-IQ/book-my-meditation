import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

type Overview = { id: string; name: string; email: string; abhyasis: { id: string; name: string; email: string }[] }[];

export default function AdminOverview() {
  const overview = useQuery({ queryKey: ['adminOverview'], queryFn: () => api<Overview>('/api/admin/overview') });

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Preceptors and their abhyasis</h2>
      <p className="text-sm text-stone-500">
        Creating preceptor accounts and invitations arrive with real login (Phase 4). For now this is a read-only overview of the sample data.
      </p>
      {overview.data?.map((p) => (
        <div key={p.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="font-semibold">{p.name} <span className="ml-1 text-sm font-normal text-stone-500">{p.email}</span></div>
          <ul className="mt-2 list-inside list-disc text-sm text-stone-700">
            {p.abhyasis.map((a) => (
              <li key={a.id}>{a.name} — {a.email}</li>
            ))}
            {p.abhyasis.length === 0 && <li className="text-stone-400">No abhyasis linked</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
