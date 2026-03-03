"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert } from "lucide-react";

/**
 * Route guard for management pages.
 * - Redirects unauthenticated users to /auth/login
 * - Shows 403 access denied for non-management users
 * - Renders children only for authenticated management users
 */
export default function ManagementGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoading, isAuthenticated, isManagement } = useAuth();
    const router = useRouter();

    // Show loading spinner while auth state is initializing
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                    <p className="text-sm text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        router.replace("/auth/login");
        return null;
    }

    // Show access denied if not a management user
    if (!isManagement) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                        <ShieldAlert className="h-7 w-7 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-6">
                        You don&apos;t have management privileges to access this page.
                        Please contact your administrator if you believe this is an error.
                    </p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
