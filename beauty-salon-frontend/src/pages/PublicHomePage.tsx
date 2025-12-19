import { type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';

const pageWrap: CSSProperties = { padding: 30 };

const card: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  borderRadius: 18,
  border: '1px solid rgba(233, 30, 99, 0.18)',
  background: '#fff5fa',
  boxShadow: '0 12px 30px rgba(0,0,0,0.06)',
};

const header: CSSProperties = {
  padding: 22,
  borderBottom: '1px solid rgba(233, 30, 99, 0.15)',
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 36,
  lineHeight: 1.1,
  color: '#8b2c3b',
  fontWeight: 900,
};

const subtitle: CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  color: '#5a2a35',
  opacity: 0.9,
  fontSize: 16,
};

const body: CSSProperties = { padding: 22 };

const sectionTitle: CSSProperties = {
  marginTop: 0,
  marginBottom: 10,
  fontWeight: 900,
  color: '#5a2a35',
};

const grid3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 14,
};

const box: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(233, 30, 99, 0.15)',
  background: '#ffffff',
  padding: 16,
};

const boxTitle: CSSProperties = { margin: 0, fontWeight: 900, color: '#5a2a35' };

const boxText: CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  color: '#5a2a35',
  opacity: 0.85,
  lineHeight: 1.5,
};

const actions: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 18,
  alignItems: 'center',
};

const btnBase: CSSProperties = {
  display: 'inline-block',
  padding: '12px 18px',
  borderRadius: 12,
  fontWeight: 900,
  textDecoration: 'none',
  border: '1px solid rgba(233, 30, 99, 0.20)',
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: '#e91e63',
  color: '#fff',
};

const btnSecondary: CSSProperties = {
  ...btnBase,
  background: '#ffffff',
  color: '#8b2c3b',
};

export function PublicHomePage(): ReactElement {
  const { isAuthenticated, user } = useAuth();

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={header}>
          <h1 style={title}>Salon Kosmetyczny</h1>
          <p style={subtitle}>Rezerwuj wizyty, zarządzaj grafikiem i pracą salonu w jednym miejscu.</p>
        </div>

        <div style={body}>
          <h2 style={sectionTitle}>Co możesz tutaj zrobić?</h2>

          <div style={grid3}>
            <div style={box}>
              <h3 style={boxTitle}>Rezerwacje</h3>
              <p style={boxText}>Klienci mogą przeglądać usługi i rezerwować wizyty.</p>
            </div>

            <div style={box}>
              <h3 style={boxTitle}>Pracownicy</h3>
              <p style={boxText}>Pracownik widzi swoje wizyty i dostępność.</p>
            </div>

            <div style={box}>
              <h3 style={boxTitle}>Manager</h3>
              <p style={boxText}>Manager zarządza usługami, grafikiem i klientami.</p>
            </div>
          </div>

          <div style={actions}>
            {!isAuthenticated ? (
              <Link to="/login" style={btnPrimary}>
                Zaloguj się
              </Link>
            ) : (
              <Link to="/dashboard" style={btnPrimary}>
                Przejdź do panelu
              </Link>
            )}

            {isAuthenticated && user ? (
              <span style={{ color: '#5a2a35', opacity: 0.85 }}>
                Zalogowano jako: <strong>{user.email}</strong>
              </span>
            ) : (
              <Link to="/services" style={btnSecondary}>
                Zobacz usługi
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicHomePage;
