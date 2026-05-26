import React from 'react';

interface Driver {
  _id: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  experience: string;
  status: string;
  employeeId?: string;
  createdAt?: string;
}

interface Props {
  driver: Driver;
  onApprove: (driver: Driver) => void;
  onReject: (driver: Driver) => void;
  onRevoke: (driver: Driver) => void;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E', label: '⏳ Pending' },
  approved: { bg: '#D1FAE5', text: '#065F46', label: '✅ Approved' },
  rejected: { bg: '#FEE2E2', text: '#991B1B', label: '❌ Rejected' },
};

export default function DriverCard({ driver, onApprove, onReject, onRevoke }: Props) {
  const status = statusConfig[driver.status] || statusConfig.pending;
  const initial = driver.fullName.charAt(0).toUpperCase();

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.avatar}>{initial}</div>
        <div style={styles.info}>
          <h3 style={styles.name}>{driver.fullName}</h3>
          <span style={{ ...styles.badge, background: status.bg, color: status.text }}>
            {status.label}
          </span>
        </div>
      </div>

      <div style={styles.details}>
        <div style={styles.detailRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span style={styles.detailText}>{driver.licenseNumber}</span>
        </div>
        <div style={styles.detailRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
          <span style={styles.detailText}>{driver.phone}</span>
        </div>
        <div style={styles.detailRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span style={styles.detailText}>{driver.experience} experience</span>
        </div>
        {driver.employeeId && (
          <div style={styles.detailRow}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B4C8C" strokeWidth="2">
              <rect x="1" y="3" width="22" height="18" rx="2" ry="2" />
              <line x1="1" y1="9" x2="23" y2="9" />
            </svg>
            <span style={{ ...styles.detailText, color: '#0B4C8C', fontWeight: '700' }}>{driver.employeeId}</span>
          </div>
        )}
      </div>

      {driver.status === 'pending' && (
        <div style={styles.actions}>
          <button style={styles.approveBtn} onClick={() => onApprove(driver)}>
            ✅ Approve
          </button>
          <button style={styles.rejectBtn} onClick={() => onReject(driver)}>
            ❌ Reject
          </button>
        </div>
      )}
      {driver.status === 'approved' && (
        <button style={styles.revokeBtn} onClick={() => onRevoke(driver)}>
          ↩ Revoke Approval
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'white',
    borderRadius: '14px',
    padding: '20px',
    marginTop: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  header: { display: 'flex', alignItems: 'center', gap: '14px' },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#0B4C8C',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '700',
  },
  info: { flex: 1 },
  name: { fontSize: '17px', fontWeight: '700', color: '#111827', margin: 0 },
  badge: { display: 'inline-flex', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', marginTop: '6px' },
  details: { marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '8px' },
  detailRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  detailText: { fontSize: '14px', color: '#6B7280' },
  actions: { display: 'flex', gap: '10px', marginTop: '16px' },
  approveBtn: {
    flex: 1, background: '#10B981', color: 'white', border: 'none', padding: '12px',
    borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  },
  rejectBtn: {
    flex: 1, background: '#EF4444', color: 'white', border: 'none', padding: '12px',
    borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  },
  revokeBtn: {
    width: '100%', background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '10px',
    borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  },
};
