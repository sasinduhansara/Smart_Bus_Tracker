import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  detail: string;
}

export function EmptyState({ icon: Icon, title, detail }: EmptyStateProps) {
  return (
    <div className="empty">
      <Icon size={27} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}
