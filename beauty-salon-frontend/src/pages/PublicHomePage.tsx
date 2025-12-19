import { type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';

const pageWrap: CSSProperties = {
  padding: 24,
  minHeight: 'calc(100vh - 56px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background:
    'radial-gradient(900px 420px at 12% 5%, rgba(233, 30, 99, 0.18), transparent 60%), radial-gradient(720px 360px at 88% 18%, rgba(109, 40, 217, 0.14), transparent 60%), linear-gradient(180deg, rgba(255, 245, 250, 0.95), rgba(255, 255, 255, 1))',
};

const card: CSSProperties = {
  width: 'min(1100px, 100%)',
  margin: '0 auto',
  borderRadius: 20,
  border: '1px solid rgba(233, 30, 99, 0.14)',
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 18px 46px rgba(17, 24, 39, 0.08)',
  overflow: 'hidden',
};

const header: CSSProperties = {
  padding: 26,
  borderBottom: '1px solid rgba(233, 30, 99, 0.12)',
  background:
    'linear-gradient(135deg, rgba(233, 30, 99, 0.10), rgba(109, 40, 217, 0.08) 55%, rgba(255, 255, 255, 0))',
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 40,
  lineHeight: 1.05,
  letterSpacing: -0.6,
  color: '#4c1d2a',
  fontWeight: 900,
};

const subtitle: CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  color: '#5a2a35',
  opacity: 0.9,
  fontSize: 16,
  lineHeight: 1.45,
  maxWidth: 640,
};

const body: CSSProperties = { padding: 26 };

const heroRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 18,
  alignItems: 'stretch',
};

const heroLeft: CSSProperties = { minWidth: 0 };







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
  borderRadius: 16,
  border: '1px solid rgba(17, 24, 39, 0.08)',
  background: 'rgba(255,255,255,0.95)',
  padding: 18,
  boxShadow: '0 12px 26px rgba(17, 24, 39, 0.06)',
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
  border: '1px solid rgba(17, 24, 39, 0.12)',
  boxShadow: '0 10px 18px rgba(17, 24, 39, 0.06)',
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: 'linear-gradient(135deg, #e91e63, #b5179e)',
  color: '#fff',
};

const btnSecondary: CSSProperties = {
  ...btnBase,
  background: 'rgba(255,255,255,0.95)',
  color: '#4c1d2a',
};

const pillRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 14,
};

const pill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(17, 24, 39, 0.10)',
  background: 'rgba(255,255,255,0.9)',
  color: '#4c1d2a',
  fontWeight: 800,
  fontSize: 13,
};

const dot: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: 'linear-gradient(135deg, rgba(233, 30, 99, 0.9), rgba(109, 40, 217, 0.75))',
  boxShadow: '0 6px 12px rgba(233, 30, 99, 0.18)',
};

const finePrint: CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  color: '#5a2a35',
  opacity: 0.8,
  fontSize: 13,
  lineHeight: 1.5,
};


export function PublicHomePage(): ReactElement {
  const { isAuthenticated, user } = useAuth();
  const servicesLink: string = isAuthenticated ? '/services' : '/login';
  const servicesLabel: string = isAuthenticated ? 'Zobacz usługi' : 'Zobacz usługi (logowanie)';

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={header}>
          <h1 style={title}>Salon Kosmetyczny</h1>
          <p style={subtitle}>Rezerwuj wizyty, zarządzaj grafikiem i pracą salonu w jednym miejscu.</p>

          <div style={pillRow}>
            <span style={pill}>
              <span style={dot} /> Szybka rezerwacja
            </span>
            <span style={pill}>
              <span style={dot} /> Kalendarz i dostępność
            </span>
            <span style={pill}>
              <span style={dot} /> Panel dla managera
            </span>
          </div>
        </div>

        <div style={body}>
          <div style={heroRow}>
            <div style={heroLeft}>
              <h2 style={sectionTitle}>Co możesz tutaj zrobić?</h2>

              <div style={grid3}>
                <div style={box}>
                  <h3 style={boxTitle}>Rezerwacje</h3>
                  <p style={boxText}>Klienci mogą przeglądać usługi i rezerwować wizyty w kilka sekund.</p>
                </div>

                <div style={box}>
                  <h3 style={boxTitle}>Pracownicy</h3>
                  <p style={boxText}>Pracownik widzi swój kalendarz, wizyty i dostępność w jednym miejscu.</p>
                </div>

                <div style={box}>
                  <h3 style={boxTitle}>Manager</h3>
                  <p style={boxText}>Manager obsługuje usługi, grafik, klientów i obejmuje kontrolę nad salonem.</p>
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

                <Link to={servicesLink} style={btnSecondary}>
                  {servicesLabel}
                </Link>

                {isAuthenticated && user ? (
                  <span style={{ color: '#5a2a35', opacity: 0.85 }}>
                    Zalogowano jako: <strong>{user.email}</strong>
                  </span>
                ) : null}
              </div>

              <p style={finePrint}>
                Strona startowa Beauty Salon Managmement System. Zapraszamy!
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicHomePage;
