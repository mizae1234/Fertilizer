'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function CustomerFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState(searchParams.get('search') || '');

    const applyFilter = () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        startTransition(() => {
            router.push(`/customers?${params}`);
        });
    };

    return (
        <div className="mb-4">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyFilter(); } }}
                    placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                    className="flex-1 max-w-md px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                />
                <button
                    onClick={applyFilter}
                    disabled={isPending}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                    {isPending ? '🔄' : 'ค้นหา'}
                </button>
            </div>
            {isPending && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    กำลังค้นหา...
                </div>
            )}
        </div>
    );
}
