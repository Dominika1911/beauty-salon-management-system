import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import { authApi } from '@/api/auth';
import type { LoginRequest, User } from '@/types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (credentials: LoginRequest) => Promise<User>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<User | null>;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isEmployee: boolean;
    isClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const didInit = useRef(false);

    const refreshUser = useCallback(async (): Promise<User | null> => {
        try {
            const data = await authApi.getStatus(); // { isAuthenticated, user }
            const nextUser = data.isAuthenticated && data.user ? data.user : null;
            setUser(nextUser);
            return nextUser;
        } catch {
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;

        const initAuth = async () => {
            try {
                await authApi.getCsrf();
                await refreshUser();
            } finally {
                setLoading(false);
            }
        };

        void initAuth();
    }, [refreshUser]);

    const login = useCallback(
        async (credentials: LoginRequest): Promise<User> => {
            await authApi.getCsrf();
            await authApi.login(credentials.username, credentials.password);
            const nextUser = await refreshUser();
            if (!nextUser) throw new Error('Logowanie nieudane - brak sesji.');
            return nextUser;
        },
        [refreshUser],
    );

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } finally {
            setUser(null);
        }
    }, []);

    const value = useMemo<AuthContextType>(
        () => ({
            user,
            loading,
            login,
            logout,
            refreshUser,
            isAuthenticated: Boolean(user),
            isAdmin: user?.role === 'ADMIN',
            isEmployee: user?.role === 'EMPLOYEE',
            isClient: user?.role === 'CLIENT',
        }),
        [user, loading, login, logout, refreshUser],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth musi być używany wewnątrz AuthProvider');
    }
    return context;
};
