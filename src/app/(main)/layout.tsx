'use client';

import Sidebar from '@/components/Sidebar';
import { useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <Sidebar onCollapsedChange={setCollapsed} />
            <main className={`pt-14 lg:pt-6 p-4 lg:p-6 transition-all duration-300 ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-64'}`}>
                {children}
            </main>
        </div>
    );
}
