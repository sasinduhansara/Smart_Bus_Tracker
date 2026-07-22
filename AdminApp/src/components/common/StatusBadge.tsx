import { humanize } from "../../utils/text";

export function StatusBadge({ value }: { value: string }) {
  const normalized = String(value || "unknown")
    .trim()
    .toLowerCase();

  const className = normalized.replace(/[\s_]+/g, "-");

  return (
    <span className={`status-pill ${className}`}>{humanize(normalized)}</span>
  );
}
