"use client";

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ManagementGuard from "@/components/ManagementGuard";

export default function ManagementLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ManagementGuard>
            <div className="flex h-screen bg-gray-50">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Topbar />
                    <main className="flex-1 overflow-y-auto p-8">
                        {children}
                    </main>
                </div>
            </div>
        </ManagementGuard>
    );
}
