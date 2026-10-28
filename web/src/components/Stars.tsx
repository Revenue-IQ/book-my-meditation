import clsx from 'clsx';
import { Star } from 'lucide-react';

/** Five stars, each filled by its own fraction of the average: 3.4 = three full stars
 *  and a 40%-filled fourth. The amber copy is clipped inside the same 20px box as its
 *  hollow star, so the two always coincide and the gaps don't skew the fraction. */
export default function Stars({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <div className="text-2xl font-semibold text-stone-400">–</div>;
  return (
    <div className={clsx('flex w-fit gap-0.5', className)} role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(Math.max(value - (i - 1), 0), 1);
        return (
          <span key={i} className="relative h-5 w-5">
            <Star className="h-5 w-5 text-stone-300" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
