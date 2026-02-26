'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const menuGroups = [
    {
        label: 'หลัก',
        items: [
            { name: 'Dashboard', href: '/', icon: '📊' },
            { name: 'POS ขายสินค้า', href: '/pos', icon: '🛒' },
            { name: 'รายการขาย', href: '/sales', icon: '💰' },
            { name: 'บิลค้างจ่าย', href: '/overdue-bills', icon: '📋' },
        ],
    },
    {
        label: 'จัดการข้อมูล',
        items: [
            { name: 'สินค้า', href: '/products', icon: '📦' },
            { name: 'ชุดสินค้า', href: '/bundles', icon: '🎁' },
            { name: 'คลังสินค้า', href: '/warehouses', icon: '🏭' },
            { name: 'ผู้ส่งสินค้า', href: '/vendors', icon: '🚚' },
            { name: 'ลูกค้า', href: '/customers', icon: '👥' },
            { name: 'กลุ่มลูกค้า', href: '/customer-groups', icon: '🏷️' },
            { name: 'Template บิล', href: '/settings/receipt-template', icon: '🧾' },
            { name: 'หมวดหมู่สินค้า', href: '/settings/product-groups', icon: '📦' },
            { name: 'บัญชีร้านค้า', href: '/bank-accounts', icon: '🏦' },
        ],
    },
    {
        label: 'เอกสาร',
        items: [
            { name: 'นำเข้าสินค้า', href: '/goods-receive', icon: '📥' },
            { name: 'โอนย้ายสินค้า', href: '/transfers', icon: '🔄' },
            { name: 'ปรับปรุง Stock', href: '/stock-adjustments', icon: '📉' },
            { name: 'บันทึกรายจ่าย', href: '/expenses', icon: '💸' },
        ],
    },
    {
        label: 'รายงาน',
        items: [
            { name: 'รายงาน (Reports)', href: '/reports', icon: '📈' },
        ],
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);

    // Read user info from JWT token
    useEffect(() => {
        try {
            const token = document.cookie.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1];
            if (token) {
                const base64 = token.split('.')[1];
                const binary = atob(base64);
                const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
                const payload = JSON.parse(new TextDecoder().decode(bytes));
                setUser({ name: payload.name || 'User', role: payload.role || '' });
            }
        } catch { /* ignore */ }
    }, []);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    const handleLogout = () => {
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.push('/login');
    };

    const displayName = user?.name || 'Admin';
    const displayRole = user?.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : user?.role === 'STAFF' ? 'พนักงาน' : 'ผู้ใช้งาน';
    const initials = displayName.charAt(0).toUpperCase();

    return (
        <>
            {/* Mobile Top Bar */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
                <button
                    onClick={() => setOpen(true)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                    aria-label="เปิดเมนู"
                >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs">
                        F
                    </div>
                    <span className="font-bold text-gray-800 text-sm">Fertilizer POS</span>
                </div>
            </div>

            {/* Backdrop (mobile) */}
            {open && (
                <div
                    className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed left-0 top-0 z-50 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out',
                    'lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Logo */}
                <div className="flex items-center justify-between px-4 lg:px-6 py-4 lg:py-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
                            F
                        </div>
                        <div>
                            <h1 className="font-bold text-gray-800 text-sm">Fertilizer POS</h1>
                            <p className="text-[10px] text-gray-400">Warehouse Management</p>
                        </div>
                    </div>
                    {/* Close button (mobile) */}
                    <button
                        onClick={() => setOpen(false)}
                        className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                        aria-label="ปิดเมนู"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                    {menuGroups.map((group) => (
                        <div key={group.label}>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                                {group.label}
                            </p>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = item.href === '/'
                                        ? pathname === '/'
                                        : pathname === item.href || pathname.startsWith(item.href + '/');
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                                                isActive
                                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            )}
                                        >
                                            <span className="text-base">{item.icon}</span>
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* User Info + Logout */}
                <div className="border-t border-gray-100 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="text-emerald-600 text-sm font-semibold">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{displayName}</p>
                            <p className="text-xs text-gray-400">{displayRole}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors border border-red-100"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        ออกจากระบบ
                    </button>
                </div>
            </aside>
        </>
    );
}
