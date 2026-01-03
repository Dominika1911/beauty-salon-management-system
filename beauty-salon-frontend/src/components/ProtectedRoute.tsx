import React from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';

import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, loading, isAuthenticated } = useAuth();

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/access-denied" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
