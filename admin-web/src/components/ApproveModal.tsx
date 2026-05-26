import React, { useState } from 'react';

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
  onApprove: (employeeId: string, password: string) => void;
  onClose: () => void;
}

export default function ApproveModal({ driver, onApprove, onClose }: Props) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!employeeId.trim() || !password.trim()) {
      alert('Employee ID and password are required');
      return;
    }
    setLoading(true);
    await onApprove(employeeId.trim(), password.trim());
    setLoading(false);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>

        <h2 style={styles.title}>Approve Driver</h2>
        <p style={styles.subtitle}>
          Setting up credentials for <strong>{driver.fullName}</strong>
        </p>

        <div style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Employee ID</label>
            <input
              style={styles.input}
              placeholder="e.g., DRV-003"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Login Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Set password for driver"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...styles.confirmBtn, ...(loading ? styles.disabled : {}) }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Processing...' : '✅ Approve Driver'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    background: 'white',
    borderRadius: '20px',
    padding: '32px',
    width: '100%',
    maxWidth: '480px',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px', right: '16px',
    background: '#F3F4F6',
    border: 'none',
    width: '32px', height: '32px',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6B7280',
  },
  title: { fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: '14px', color: '#6B7280', margin: '0 0 24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  inputGroup: { textAlign: 'left' },
  label: { fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid #E5E7EB',
    fontSize: '15px',
    background: '#F9FAFB',
    boxSizing: 'border-box',
    outline: 'none',
  },
  actions: { display: 'flex', gap: '10px', marginTop: '24px' },
  cancelBtn: {
    flex: 1, background: '#F3F4F6', color: '#6B7280', border: 'none',
    padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
  },
  confirmBtn: {
    flex: 1, background: '#10B981', color: 'white', border: 'none',
    padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
  },
  disabled: { opacity: 0.7, cursor: 'not-allowed' },
};
