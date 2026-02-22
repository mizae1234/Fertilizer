'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function SalesDateFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [from, setFrom] = useState(searchParams.get('from') || '');
    const [to, setTo] = useState(searchParams.get('to') || '');

    const applyFilter = () => {
        const params = new URLSearchParams();
        const status = searchParams.get('status') || '';
        if (status) params.set('status', status);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        startTransition(() => {
            router.push(`/sales?${params}`);
        });
    };

    const clearFilter = () => {
        setFrom('');
        setTo('');
        const params = new URLSearchParams();
        const status = searchParams.get('status') || '';
        if (status) params.set('status', status);
        startTransition(() => {
            router.push(`/sales?${params}`);
        });
    };

    return (
        <div className="flex items-end gap-2 ml-auto">
            <div>
                <label className="text-xs text-gray-500 mb-1 block">จากวันที่</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
                <label className="text-xs text-gray-500 mb-1 block">ถึงวันที่</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <button onClick={applyFilter} disabled={isPending}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                {isPending ? '🔄' : 'กรอง'}
            </button>
            {(from || to) && (
                <button onClick={clearFilter} className="px-3 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50">ล้าง</button>
            )}
        </div>
    );
}
