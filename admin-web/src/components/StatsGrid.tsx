import React from 'react';

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface Props {
  stats: Stats;
}

const cards = [
  { label: 'Total Drivers', key: 'total' as keyof Stats, color: '#0B4C8C', bg: '#EEF2FF', icon: '👥' },
  { label: 'Pending Review', key: 'pending' as keyof Stats, color: '#F59E0B', bg: '#FEF3C7', icon: '⏳' },
  { label: 'Approved', key: 'approved' as keyof Stats, color: '#10B981', bg: '#D1FAE5', icon: '✅' },
  { label: 'Rejected', key: 'rejected' as keyof Stats, color: '#EF4444', bg: '#FEE2E2', icon: '❌' },
];

export default function StatsGrid({ stats }: Props) {
  return (
    <div style={styles.grid}>
      {cards.map((card) => (
        <div key={card.key} style={{ ...styles.card, borderLeft: `4px solid ${card.color}`, background: card.bg }}>
          <div style={styles.cardContent}>
            <span style={{ fontSize: '28px' }}>{card.icon}</span>
            <div style={styles.cardInfo}>
              <span style={{ ...styles.cardValue, color: card.color }}>{stats[card.key]}</span>
              <span style={styles.cardLabel}>{card.label}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    padding: '0 24px',
    marginTop: '20px',
  },
  card: {
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardValue: {
    fontSize: '28px',
    fontWeight: '800',
    lineHeight: '32px',
  },
  cardLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#6B7280',
    marginTop: '2px',
  },
};
