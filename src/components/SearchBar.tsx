'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function SearchBar({ placeholder = '🔍 ค้นหา...' }: { placeholder?: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState(searchParams.get('search') || '');

    const doSearch = () => {
        const params = new URLSearchParams();
        // Preserve all existing params except search and page
        searchParams.forEach((v, k) => {
            if (k !== 'search' && k !== 'page') params.set(k, v);
        });
        if (search.trim()) params.set('search', search.trim());
        startTransition(() => router.push(`${pathname}?${params}`));
    };

    const clearSearch = () => {
        setSearch('');
        const params = new URLSearchParams();
        searchParams.forEach((v, k) => {
            if (k !== 'search' && k !== 'page') params.set(k, v);
        });
        startTransition(() => router.push(`${pathname}?${params}`));
    };

    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } }}
                placeholder={placeholder}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
            />
            <button
                onClick={doSearch}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
                {isPending ? '🔄' : 'ค้นหา'}
            </button>
            {searchParams.get('search') && (
                <button
                    onClick={clearSearch}
                    className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
                >
                    ล้าง
                </button>
            )}
        </div>
    );
}
