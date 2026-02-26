"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User, getAccessToken, setAccessToken } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isManagement: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (data: {
        email: string;
        username: string;
        password: string;
        confirm_password: string;
        full_name?: string;
    }) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = async () => {
        try {
            const token = getAccessToken();
            if (!token) {
                setUser(null);
                return;
            }

            const response = await authApi.getCurrentUser();
            if (response.success) {
                setUser(response.data);
            } else {
                setUser(null);
                setAccessToken(null);
            }
        } catch (error: any) {
            const message = typeof error?.message === 'string' ? error.message : '';
            const isNetworkError = message.toLowerCase().includes('unable to connect to the server');

            if (isNetworkError) {
                setUser(null);
                return;
            }

            if (process.env.NODE_ENV !== 'production') {
                console.error('Failed to refresh user:', error);
            }
            setUser(null);
            setAccessToken(null);
        }
    };

    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);
            await refreshUser();
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            console.log('Attempting login for:', email);
            const response = await authApi.login({ email, password });
            console.log('Login response:', response);
            if (response.success) {
                setUser(response.data.user);
            } else {
                throw new Error(response.message || 'Login failed');
            }
        } catch (error: any) {
            console.error('Login error:', error);
            throw new Error(error.message || 'Failed to connect to server');
        }
    };

    const signup = async (data: {
        email: string;
        username: string;
        password: string;
        confirm_password: string;
        full_name?: string;
    }) => {
        const response = await authApi.signup(data);
        if (response.success) {
            setUser(response.data.user);
        } else {
            throw new Error(response.message || 'Signup failed');
        }
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } finally {
            setUser(null);
        }
    };

    const value = React.useMemo(
        () => ({
            user,
            isLoading,
            isAuthenticated: !!user,
            isManagement: !!user?.is_management,
            login,
            signup,
            logout,
            refreshUser,
        }),
        [user, isLoading]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
