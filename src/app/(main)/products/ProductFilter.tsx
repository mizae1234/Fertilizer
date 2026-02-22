'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

interface Warehouse { id: string; name: string; }
interface ProductGroup { id: string; name: string; }

export default function ProductFilter({ warehouses, productGroups }: { warehouses: Warehouse[]; productGroups?: ProductGroup[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [warehouse, setWarehouse] = useState(searchParams.get('warehouse') || '');
    const [group, setGroup] = useState(searchParams.get('group') || '');

    const applyFilter = (overrides?: { search?: string; warehouse?: string; group?: string }) => {
        const s = overrides?.search ?? search;
        const w = overrides?.warehouse ?? warehouse;
        const g = overrides?.group ?? group;
        const params = new URLSearchParams();
        if (s) params.set('search', s);
        if (w) params.set('warehouse', w);
        if (g) params.set('group', g);
        startTransition(() => {
            router.push(`/products?${params}`);
        });
    };

    return (
        <div className="mb-4">
            <div className="flex flex-wrap gap-2">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyFilter(); } }}
                    placeholder="ค้นหาชื่อ, รหัส, หรือยี่ห้อ..."
                    className="flex-1 min-w-[200px] max-w-md px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                />
                <select
                    value={warehouse}
                    onChange={e => { setWarehouse(e.target.value); applyFilter({ warehouse: e.target.value }); }}
                    className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="">คลังทั้งหมด</option>
                    {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                {productGroups && productGroups.length > 0 && (
                    <select
                        value={group}
                        onChange={e => { setGroup(e.target.value); applyFilter({ group: e.target.value }); }}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">หมวดหมู่ทั้งหมด</option>
                        {productGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                )}
                <button
                    onClick={() => applyFilter()}
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
