'use client';

import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
                (target as HTMLInputElement).blur();
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <Sidebar onCollapsedChange={setCollapsed} />
            <main className={`pt-14 lg:pt-6 p-4 lg:p-6 transition-all duration-300 ${collapsed ? 'lg:ml-[68px]' : 'lg:ml-64'}`}>
                {children}
            </main>
        </div>
    );
}
