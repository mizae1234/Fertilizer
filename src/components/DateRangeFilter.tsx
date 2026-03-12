'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function DateRangeFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [from, setFrom] = useState(searchParams.get('from') || '');
    const [to, setTo] = useState(searchParams.get('to') || '');

    const navigate = (f: string, t: string) => {
        const params = new URLSearchParams();
        searchParams.forEach((v, k) => { if (k !== 'from' && k !== 'to' && k !== 'page') params.set(k, v); });
        if (f) params.set('from', f);
        if (t) params.set('to', t);
        startTransition(() => router.push(`${pathname}?${params}`));
    };

    // Auto-apply when date changes
    const handleFromChange = (value: string) => {
        setFrom(value);
        navigate(value, to);
    };

    const handleToChange = (value: string) => {
        setTo(value);
        navigate(from, value);
    };

    const setQuick = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() - days);
        const f = d.toISOString().slice(0, 10);
        const t = new Date().toISOString().slice(0, 10);
        setFrom(f); setTo(t);
        navigate(f, t);
    };

    const clearFilter = () => {
        setFrom(''); setTo('');
        navigate('', '');
    };

    return (
        <div className="flex flex-wrap items-end gap-2 ml-auto">
            <div>
                <label className="text-xs text-gray-500 mb-1 block">จากวันที่</label>
                <input type="date" value={from} onChange={e => handleFromChange(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
                <label className="text-xs text-gray-500 mb-1 block">ถึงวันที่</label>
                <input type="date" value={to} onChange={e => handleToChange(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            {isPending && <span className="text-xs text-gray-400 self-center">🔄</span>}
            <div className="flex gap-1">
                {[{ l: '7 วัน', d: 7 }, { l: '30 วัน', d: 30 }, { l: '90 วัน', d: 90 }].map(o => (
                    <button key={o.d} onClick={() => setQuick(o.d)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
                        {o.l}
                    </button>
                ))}
                <button onClick={clearFilter} className="px-2.5 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50">ล้าง</button>
            </div>
        </div>
    );
}
