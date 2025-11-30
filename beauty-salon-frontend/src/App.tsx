import React from 'react';
import AppRouter from './router';
import { AuthProvider } from './context/AuthContext.tsx';

function App(): React.ReactElement {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
