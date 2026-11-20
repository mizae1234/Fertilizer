'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export interface ProductOptionLite {
    id: string;
    code: string;
    barcode?: string | null;
    name: string;
    unit: string;
    brand?: string | null;
}

interface SalesProductFilterProps {
    initialProduct?: ProductOptionLite | null;
}

const AUTOCOMPLETE_DEBOUNCE_MS = 250;
const AUTOCOMPLETE_LIMIT = 20;

export default function SalesProductFilter({ initialProduct = null }: SalesProductFilterProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const urlProductId = searchParams.get('productId') || '';
    const urlProductSearch = searchParams.get('productSearch') || '';

    const [selectedProduct, setSelectedProduct] = useState<ProductOptionLite | null>(
        urlProductId && initialProduct?.id === urlProductId ? initialProduct : null
    );
    const [query, setQuery] = useState(urlProductSearch);
    const [options, setOptions] = useState<ProductOptionLite[]>([]);
    const [open, setOpen] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [highlightedIdx, setHighlightedIdx] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync state when URL changes externally (e.g. browser Back/Forward or status tabs)
    useEffect(() => {
        if (urlProductId && initialProduct?.id === urlProductId) {
            setSelectedProduct(initialProduct);
            setQuery('');
        } else if (!urlProductId) {
            setSelectedProduct(null);
            setQuery(urlProductSearch);
        }
    }, [urlProductId, urlProductSearch, initialProduct]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    // Debounced autocomplete fetch with AbortController
    useEffect(() => {
        const trimmed = query.trim();
        if (!open || trimmed.length === 0 || selectedProduct) {
            setOptions([]);
            setFetching(false);
            return;
        }

        const controller = new AbortController();
        setFetching(true);

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/products?lite=1&includeInactive=1&limit=${AUTOCOMPLETE_LIMIT}&search=${encodeURIComponent(trimmed)}`,
                    { signal: controller.signal }
                );
                if (!res.ok) throw new Error('Failed to search products');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setOptions(data);
                    setHighlightedIdx(-1);
                }
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Product autocomplete error:', err);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setFetching(false);
                }
            }
        }, AUTOCOMPLETE_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, open, selectedProduct]);

    const pushProductParams = (nextProductId: string, nextProductSearch: string) => {
        const params = new URLSearchParams();
        searchParams.forEach((v, k) => {
            if (k !== 'productId' && k !== 'productSearch' && k !== 'page') {
                params.set(k, v);
            }
        });
        if (nextProductId) {
            params.set('productId', nextProductId);
        } else if (nextProductSearch) {
            params.set('productSearch', nextProductSearch);
        }
        const qs = params.toString();
        startTransition(() => {
            router.push(qs ? `${pathname}?${qs}` : pathname);
        });
    };

    const handleSelectOption = (opt: ProductOptionLite) => {
        setSelectedProduct(opt);
        setQuery('');
        setOpen(false);
        setHighlightedIdx(-1);
        pushProductParams(opt.id, '');
    };

    const handleBroadSearch = () => {
        const trimmed = query.trim();
        setSelectedProduct(null);
        setOpen(false);
        setHighlightedIdx(-1);
        pushProductParams('', trimmed);
    };

    const handleClear = () => {
        setSelectedProduct(null);
        setQuery('');
        setOptions([]);
        setOpen(false);
        setHighlightedIdx(-1);
        pushProductParams('', '');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            if (!open && query.trim()) setOpen(true);
            if (options.length > 0) {
                e.preventDefault();
                setHighlightedIdx((prev) => (prev < options.length - 1 ? prev + 1 : 0));
            }
        } else if (e.key === 'ArrowUp') {
            if (options.length > 0) {
                e.preventDefault();
                setHighlightedIdx((prev) => (prev > 0 ? prev - 1 : options.length - 1));
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && highlightedIdx >= 0 && options[highlightedIdx]) {
                handleSelectOption(options[highlightedIdx]);
            } else {
                handleBroadSearch();
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
            setHighlightedIdx(-1);
        }
    };

    const hasActiveFilter = Boolean(urlProductId || urlProductSearch);

    return (
        <div ref={containerRef} className={`relative ${open ? 'z-40' : ''}`}>
            {selectedProduct ? (
                <div className="flex items-center gap-2">
                    <div
                        onClick={() => {
                            const prevName = selectedProduct.name;
                            setSelectedProduct(null);
                            setQuery(prevName);
                            setOpen(true);
                            setTimeout(() => inputRef.current?.select(), 0);
                        }}
                        className="flex-1 px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/70 text-sm text-emerald-900 flex items-center justify-between gap-2 cursor-pointer hover:bg-emerald-50 transition-colors min-w-0"
                        title="คลิกเพื่อเปลี่ยนคำค้นหาสินค้า"
                    >
                        <div className="truncate">
                            <span className="font-mono text-xs text-emerald-600 mr-1.5">
                                [{selectedProduct.code}]
                            </span>
                            <span className="font-medium">{selectedProduct.name}</span>
                            <span className="text-xs text-emerald-600 ml-1">
                                ({selectedProduct.unit})
                            </span>
                        </div>
                        {isPending && <span className="text-xs shrink-0">🔄</span>}
                    </div>
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={isPending}
                        className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
                    >
                        ล้าง
                    </button>
                </div>
            ) : (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setOpen(true);
                            }}
                            onFocus={() => {
                                if (query.trim()) setOpen(true);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="พิมพ์ชื่อสินค้า, รหัส หรือบาร์โค้ด..."
                            className="w-full px-4 py-2.5 pr-8 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (hasActiveFilter) {
                                        handleClear();
                                    } else {
                                        setQuery('');
                                        setOptions([]);
                                        inputRef.current?.focus();
                                    }
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 text-xs"
                                title="ล้างข้อความ"
                            >
                                ✕
                            </button>
                        )}

                        {/* Autocomplete Dropdown */}
                        {open && query.trim().length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                                {/* Option 0: Broad keyword search */}
                                <button
                                    type="button"
                                    onClick={handleBroadSearch}
                                    className="w-full text-left px-3.5 py-2.5 text-xs bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 font-medium border-b border-gray-100 flex items-center justify-between gap-2"
                                >
                                    <span className="truncate">
                                        🔍 ค้นหาทุกสินค้าที่มีคำว่า &ldquo;{query.trim()}&rdquo;
                                    </span>
                                    <span className="text-[11px] text-emerald-600 shrink-0">Enter ↵</span>
                                </button>

                                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                                    {fetching ? (
                                        <div className="px-4 py-4 text-xs text-gray-400 text-center">
                                            กำลังค้นหาสินค้า...
                                        </div>
                                    ) : options.length === 0 ? (
                                        <div className="px-4 py-4 text-xs text-gray-400 text-center">
                                            ไม่พบสินค้าที่ตรงกับคำค้นหา
                                        </div>
                                    ) : (
                                        options.map((opt, idx) => {
                                            const isHighlighted = idx === highlightedIdx;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedIdx(idx)}
                                                    onClick={() => handleSelectOption(opt)}
                                                    className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                                                        isHighlighted ? 'bg-emerald-50' : 'hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-gray-800 truncate">
                                                            {opt.name}
                                                        </p>
                                                        <p className="text-xs text-gray-400 truncate">
                                                            <span className="font-mono">{opt.code}</span>
                                                            {opt.brand ? ` · ${opt.brand}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-gray-400 shrink-0 bg-gray-100 px-2 py-0.5 rounded">
                                                        {opt.unit}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleBroadSearch}
                        disabled={isPending}
                        className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 shrink-0"
                    >
                        {isPending ? '🔄' : 'ค้นหา'}
                    </button>
                    {hasActiveFilter && (
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={isPending}
                            className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 shrink-0"
                        >
                            ล้าง
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
