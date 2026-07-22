import { RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading live data...' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <RefreshCw size={19} className="spin" />
      {label}
    </div>
  );
}
