'use client';

import { cn } from '@/lib/utils';

interface Column<T> {
    key: string;
    label: string;
    render?: (item: T) => React.ReactNode;
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    totalPages?: number;
    currentPage?: number;
    onPageChange?: (page: number) => void;
    emptyMessage?: string;
    onRowClick?: (item: T) => void;
}

export default function DataTable<T extends { id?: string }>({
    columns,
    data,
    totalPages = 1,
    currentPage = 1,
    onPageChange,
    emptyMessage = 'ไม่พบข้อมูล',
    onRowClick,
}: DataTableProps<T>) {
    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={cn(
                                        'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider',
                                        col.className
                                    )}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((item, idx) => (
                                <tr
                                    key={(item as Record<string, unknown>).id as string || idx}
                                    className={cn(
                                        'hover:bg-gray-50 transition-colors',
                                        onRowClick && 'cursor-pointer'
                                    )}
                                    onClick={() => onRowClick?.(item)}
                                >
                                    {columns.map((col) => (
                                        <td key={col.key} className={cn('px-4 py-3 text-sm text-gray-700', col.className)}>
                                            {col.render
                                                ? col.render(item)
                                                : (item as Record<string, unknown>)[col.key] as React.ReactNode}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                        หน้า {currentPage} จาก {totalPages}
                    </p>
                    <div className="flex gap-1">
                        <button
                            onClick={() => onPageChange?.(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ก่อนหน้า
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const page = i + 1;
                            return (
                                <button
                                    key={page}
                                    onClick={() => onPageChange?.(page)}
                                    className={cn(
                                        'px-3 py-1.5 text-sm rounded-lg',
                                        currentPage === page
                                            ? 'bg-emerald-500 text-white'
                                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    )}
                                >
                                    {page}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => onPageChange?.(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ถัดไป
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
