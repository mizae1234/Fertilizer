'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdjustmentFilter() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [search, setSearch] = useState(searchParams.get('search') || '');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const p = new URLSearchParams();
        if (search) p.set('search', search);
        router.push(`/stock-adjustments?${p.toString()}`);
    };

    return (
        <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="ค้นหาด้วยเลขที่ / ชื่อสินค้า / เหตุผล..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-white"
                />
                <button type="submit" className="px-4 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium hover:bg-gray-900">
                    ค้นหา
                </button>
            </div>
        </form>
    );
}
