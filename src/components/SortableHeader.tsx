import Link from 'next/link';

interface SortableHeaderProps {
    label: string;
    field: string;
    currentSort: string;
    currentOrder: string;
    buildUrl: (params: Record<string, string>) => string;
    align?: 'left' | 'right' | 'center';
}

export default function SortableHeader({ label, field, currentSort, currentOrder, buildUrl, align = 'left' }: SortableHeaderProps) {
    const isActive = currentSort === field;
    const nextOrder = isActive && currentOrder === 'asc' ? 'desc' : 'asc';
    const arrow = isActive ? (currentOrder === 'asc' ? ' ↑' : ' ↓') : '';

    return (
        <th className={`px-4 py-3 text-${align} text-xs font-semibold text-gray-500 uppercase tracking-wider`}>
            <Link
                href={buildUrl({ sort: field, order: nextOrder, page: '1' })}
                className={`inline-flex items-center gap-0.5 hover:text-emerald-600 transition-colors ${isActive ? 'text-emerald-600' : ''}`}
            >
                {label}{arrow}
            </Link>
        </th>
    );
}
