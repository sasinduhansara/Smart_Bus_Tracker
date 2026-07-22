import { RefreshCw } from "lucide-react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  onRefresh: () => void;
  loading: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  onRefresh,
  loading,
}: PageHeaderProps) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>

      <button
        type="button"
        className="secondary-button"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw size={16} className={loading ? "spin" : ""} />
        Refresh
      </button>
    </div>
  );
}
