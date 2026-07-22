import { AlertTriangle, Check } from 'lucide-react';

interface NoticeProps {
  tone: 'success' | 'error';
  message: string;
}

export function Notice({ tone, message }: NoticeProps) {
  const Icon = tone === 'success' ? Check : AlertTriangle;

  return (
    <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={17} />
      {message}
    </div>
  );
}
