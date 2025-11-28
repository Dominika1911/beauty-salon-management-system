import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';

function DashboardPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Panel salonu</h1>
      <p>Tu później zrobimy dashboard (wizyty, klienci, pracownicy itd.).</p>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
