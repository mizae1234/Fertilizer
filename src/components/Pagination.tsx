'use client';

import Link from 'next/link';

interface PaginationProps {
    page: number;
    totalPages: number;
    /** For client-side pages using state */
    onPageChange?: (page: number) => void;
    /** For server-side pages: base path e.g. "/goods-receive" */
    basePath?: string;
    /** For server-side pages: current search params (page will be overridden) */
    params?: Record<string, string>;
}

/**
 * Reusable pagination with page number buttons.
 * Supports both client-side (onPageChange) and server-side (basePath+params with Link) patterns.
 * Shows: ‹ 1 ... 4 5 [6] 7 8 ... 20 ›
 */
export default function Pagination({ page, totalPages, onPageChange, basePath, params }: PaginationProps) {
    if (totalPages <= 1) return null;

    // Build URL for a given page number (server-side mode)
    const buildUrl = (p: number): string => {
        if (!basePath) return '#';
        const sp = new URLSearchParams(params || {});
        if (p > 1) {
            sp.set('page', String(p));
        } else {
            sp.delete('page');
        }
        const qs = sp.toString();
        return qs ? `${basePath}?${qs}` : basePath;
    };

    // Generate page numbers to display
    const getPageNumbers = (): (number | '...')[] => {
        const pages: (number | '...')[] = [];
        const delta = 2;

        pages.push(1);

        const rangeStart = Math.max(2, page - delta);
        const rangeEnd = Math.min(totalPages - 1, page + delta);

        if (rangeStart > 2) pages.push('...');

        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(i);
        }

        if (rangeEnd < totalPages - 1) pages.push('...');

        if (totalPages > 1) pages.push(totalPages);

        return pages;
    };

    const pageNumbers = getPageNumbers();

    const buttonBase = 'min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center';
    const activeClass = 'bg-emerald-500 text-white shadow-sm';
    const inactiveClass = 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200';
    const disabledClass = 'text-gray-300 cursor-not-allowed';
    const arrowClass = 'h-9 px-3 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center border border-gray-200';

    const renderPageButton = (p: number) => {
        const isActive = p === page;
        const className = `${buttonBase} ${isActive ? activeClass : inactiveClass}`;

        if (basePath) {
            return (
                <Link key={p} href={buildUrl(p)} className={className}>
                    {p}
                </Link>
            );
        }

        return (
            <button
                key={p}
                onClick={() => onPageChange?.(p)}
                className={className}
            >
                {p}
            </button>
        );
    };

    const renderPrev = () => {
        const disabled = page <= 1;
        if (basePath && !disabled) {
            return (
                <Link href={buildUrl(page - 1)} className={`${arrowClass} text-gray-600 hover:bg-gray-50`}>
                    ‹
                </Link>
            );
        }
        return (
            <button
                onClick={() => !disabled && onPageChange?.(page - 1)}
                disabled={disabled}
                className={`${arrowClass} ${disabled ? disabledClass : 'text-gray-600 hover:bg-gray-50'}`}
            >
                ‹
            </button>
        );
    };

    const renderNext = () => {
        const disabled = page >= totalPages;
        if (basePath && !disabled) {
            return (
                <Link href={buildUrl(page + 1)} className={`${arrowClass} text-gray-600 hover:bg-gray-50`}>
                    ›
                </Link>
            );
        }
        return (
            <button
                onClick={() => !disabled && onPageChange?.(page + 1)}
                disabled={disabled}
                className={`${arrowClass} ${disabled ? disabledClass : 'text-gray-600 hover:bg-gray-50'}`}
            >
                ›
            </button>
        );
    };

    return (
        <div className="flex items-center justify-center gap-1 py-3">
            {renderPrev()}
            {pageNumbers.map((p, i) =>
                p === '...'
                    ? <span key={`dots-${i}`} className="px-1 text-gray-400 text-sm">…</span>
                    : renderPageButton(p)
            )}
            {renderNext()}
            <span className="ml-2 text-xs text-gray-400">({page}/{totalPages})</span>
        </div>
    );
}
