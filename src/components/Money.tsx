// Renders a value at risk, or a redaction marker when the selector returned null for this role.
import { EyeOff } from 'lucide-react';
import { formatSGD } from '../lib/format';

export function Money({ value, className = '' }: { value: number | null; className?: string }) {
  if (value === null) {
    return (
      <span className={`inline-flex items-center gap-1 text-slate-400 ${className}`} title="Not shown for your role">
        <EyeOff className="h-3 w-3" aria-hidden /> Restricted
      </span>
    );
  }
  return <span className={`tabular-nums ${className}`}>{formatSGD(value)}</span>;
}
