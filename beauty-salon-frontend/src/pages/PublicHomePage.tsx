import React, { type CSSProperties, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
  border: '1px solid rgba(233, 30, 99, 0.28)',
  background: '#ffffff',
  color: '#5a2a35',
  textDecoration: 'none',
  fontWeight: 900,
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: '#f8c1cc',
  borderColor: 'rgba(233, 30, 99, 0.35)',
};

const footer: CSSProperties = {
  marginTop: 22,
  paddingTop: 14,
  borderTop: '1px solid rgba(233, 30, 99, 0.15)',
  color: '#5a2a35',
  opacity: 0.7,
  fontSize: 13,
};

export function PublicHomePage(): ReactElement {
  const { user } = useAuth();

  // Panel jest pod /dashboard (a jak nie zalogowany -> /login)
  const panelPath = user ? '/dashboard' : '/login';
  const panelLabel = user ? 'Przejdź do panelu' : 'Zaloguj się do systemu';

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={header}>
          <h1 style={title}>Beauty Salon</h1>
          <p style={subtitle}>System obsługi salonu kosmetycznego (rezerwacje, grafik, klienci, usługi).</p>
        </div>

        <div style={body}>
          <h2 style={sectionTitle}>Dla kogo jest system?</h2>
          <div style={grid3}>
            <div style={box}>
              <h3 style={boxTitle}>Klienci</h3>
              <p style={boxText}>Rezerwacja wizyt online, podgląd historii wizyt oraz dostęp do oferty salonu.</p>
            </div>

            <div style={box}>
              <h3 style={boxTitle}>Pracownicy</h3>
              <p style={boxText}>Dostęp do grafiku i listy wizyt oraz podstawowych danych potrzebnych do obsługi klientów.</p>
            </div>

            <div style={box}>
              <h3 style={boxTitle}>Administrator</h3>
              <p style={boxText}>
                Zarządzanie klientami, pracownikami, usługami, rezerwacjami, raportami, ustawieniami i logami.
              </p>
            </div>
          </div>

          <h2 style={{ ...sectionTitle, marginTop: 22 }}>Jak to działa?</h2>
          <div style={grid3}>
            <div style={box}>
              <h3 style={boxTitle}>1. Logowanie</h3>
              <p style={boxText}>Użytkownik loguje się do systemu i uzyskuje dostęp zgodny ze swoją rolą.</p>
            </div>

            <div style={box}>
              <h3 style={boxTitle}>2. Rezerwacje i obsługa</h3>
              <p style={boxText}>Umawianie wizyt, prowadzenie grafiku i obsługa klientów odbywa się w jednym miejscu.</p>
            </div>

            <div style={box}>
              <h3 style={boxTitle}>3. Raporty i kontrola</h3>
              <p style={boxText}>Administrator ma dostęp do statystyk, raportów i logów operacji w systemie.</p>
            </div>
          </div>

          <div style={actions}>
            <Link to={panelPath} style={btnPrimary}>
              {panelLabel}
            </Link>

            <span style={{ color: '#5a2a35', opacity: 0.75, fontSize: 13 }}>Panel dostępny po zalogowaniu</span>
          </div>

          <div style={footer}>
            <div>Frontend: React + TypeScript • Backend: Django REST Framework • DB: PostgreSQL</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublicHomePage;
