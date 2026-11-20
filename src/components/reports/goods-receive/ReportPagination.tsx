'use client';

import React from 'react';

interface ReportPaginationProps {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (nextPage: number) => void;
    itemLabel?: string;
}

export default function ReportPagination({
    page,
    totalPages,
    totalItems,
    onPageChange,
    itemLabel = 'รายการ',
}: ReportPaginationProps) {
    if (totalPages <= 1) return null;

    const buildPages = (): (number | 'ellipsis-start' | 'ellipsis-end')[] => {
        const maxVisible = 7;
        if (totalPages <= maxVisible) {
            return Array.from({ length: totalPages }, (_, idx) => idx + 1);
        }
        const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [1];
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);

        if (start > 2) pages.push('ellipsis-start');
        for (let p = start; p <= end; p++) pages.push(p);
        if (end < totalPages - 1) pages.push('ellipsis-end');
        pages.push(totalPages);
        return pages;
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 mt-3">
            <span className="text-xs text-gray-500">
                หน้า <strong>{page}</strong> จาก <strong>{totalPages}</strong> (ทั้งหมด {totalItems.toLocaleString()} {itemLabel})
            </span>
            <div className="flex items-center gap-1 flex-wrap">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                    ←
                </button>
                {buildPages().map((p) =>
                    typeof p === 'string' ? (
                        <span key={p} className="px-1.5 text-xs text-gray-400">
                            ...
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPageChange(p)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                page === p
                                    ? 'bg-emerald-500 text-white shadow-xs'
                                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                    →
                </button>
            </div>
        </div>
    );
}
