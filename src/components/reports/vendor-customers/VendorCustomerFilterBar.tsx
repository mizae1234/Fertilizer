'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { VendorOptionWithCount } from '@/types/vendor-customer-report';

interface VendorCustomerFilterBarProps {
    vendors: VendorOptionWithCount[];
    brands: string[];
    vendorId: string;
    brand: string;
    customerSearchInput: string;
    minSpendInput: string;
    minQuantityInput: string;
    excludeWalkIn: boolean;
    onVendorChange: (id: string) => void;
    onBrandChange: (brand: string) => void;
    onCustomerSearchChange: (val: string) => void;
    onMinSpendChange: (val: string) => void;
    onMinQuantityChange: (val: string) => void;
    onExcludeWalkInChange: (exclude: boolean) => void;
    onReset: () => void;
    hasActiveFilters: boolean;
}

export default function VendorCustomerFilterBar({
    vendors,
    brands,
    vendorId,
    brand,
    customerSearchInput,
    minSpendInput,
    minQuantityInput,
    excludeWalkIn,
    onVendorChange,
    onBrandChange,
    onCustomerSearchChange,
    onMinSpendChange,
    onMinQuantityChange,
    onExcludeWalkInChange,
    onReset,
    hasActiveFilters,
}: VendorCustomerFilterBarProps) {
    const [vendorOpen, setVendorOpen] = useState(false);
    const [vendorQuery, setVendorQuery] = useState('');
    const vendorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) {
                setVendorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const selectedVendor = useMemo(
        () => vendors.find((v) => v.id === vendorId) || null,
        [vendors, vendorId]
    );

    const filteredVendors = useMemo(() => {
        const q = vendorQuery.trim().toLowerCase();
        if (!q) return vendors;
        return vendors.filter((v) => v.name.toLowerCase().includes(q));
    }, [vendors, vendorQuery]);

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Searchable Vendor Combobox */}
                <div ref={vendorRef} className={`relative ${vendorOpen ? 'z-40' : ''}`}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        🏢 เลือกผู้ขาย (Vendor)
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setVendorOpen((prev) => !prev);
                            setVendorQuery('');
                        }}
                        className={`w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center justify-between gap-2 transition-colors ${
                            vendorId
                                ? 'border-emerald-400 bg-emerald-50/50 text-emerald-900 font-medium'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <span className="truncate">
                            {selectedVendor
                                ? `${selectedVendor.name} (${selectedVendor.productCount})`
                                : '-- เลือกบริษัทผู้ขาย --'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                            {vendorId && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onVendorChange('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.stopPropagation();
                                            onVendorChange('');
                                        }
                                    }}
                                    className="text-gray-400 hover:text-rose-500 px-1 text-xs"
                                    title="ล้างผู้ขาย"
                                >
                                    ✕
                                </span>
                            )}
                            <span className="text-gray-400 text-xs">▼</span>
                        </div>
                    </button>

                    {vendorOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                            <div className="p-2 border-b border-gray-100">
                                <input
                                    type="text"
                                    value={vendorQuery}
                                    onChange={(e) => setVendorQuery(e.target.value)}
                                    placeholder="พิมพ์ค้นหาชื่อผู้ขาย..."
                                    autoFocus
                                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                                {filteredVendors.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-gray-400 text-center">
                                        ไม่พบรายชื่อผู้ขาย
                                    </p>
                                ) : (
                                    filteredVendors.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => {
                                                onVendorChange(v.id);
                                                setVendorOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center justify-between gap-2 ${
                                                vendorId === v.id
                                                    ? 'bg-emerald-50 font-semibold text-emerald-700'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            <span className="truncate">{v.name}</span>
                                            <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                                                {v.productCount} สินค้า
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Optional Brand Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        🏷️ ยี่ห้อสินค้า (เสริม)
                    </label>
                    <select
                        value={brand}
                        onChange={(e) => onBrandChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                    >
                        <option value="">ทุกยี่ห้อ</option>
                        {brands.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. Minimum Spend Promo Threshold */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        💰 ยอดซื้อขั้นต่ำรับโปร (บาท)
                    </label>
                    <input
                        type="number"
                        min={0}
                        step="any"
                        value={minSpendInput}
                        onChange={(e) => onMinSpendChange(e.target.value)}
                        placeholder="เช่น 10000"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                    />
                </div>

                {/* 4. Minimum Quantity Promo Threshold */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        📦 จำนวนหน่วยขั้นต่ำรับโปร
                    </label>
                    <input
                        type="number"
                        min={0}
                        step="any"
                        value={minQuantityInput}
                        onChange={(e) => onMinQuantityChange(e.target.value)}
                        placeholder="เช่น 50"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                    />
                </div>
            </div>

            {/* Secondary Row: Customer Search + Exclude Walk-in Toggle + Reset */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
                    <div className="relative flex-1 max-w-sm">
                        <input
                            type="text"
                            value={customerSearchInput}
                            onChange={(e) => onCustomerSearchChange(e.target.value)}
                            placeholder="🔍 ค้นหาชื่อลูกค้า, เบอร์โทร, กลุ่มลูกค้า หรือสินค้า..."
                            className="w-full px-3 py-1.5 pr-7 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                        />
                        {customerSearchInput && (
                            <button
                                type="button"
                                onClick={() => onCustomerSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={excludeWalkIn}
                            onChange={(e) => onExcludeWalkInChange(e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>ซ่อน &ldquo;ลูกค้าทั่วไป (ไม่ระบุชื่อ)&rdquo;</span>
                    </label>
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                    >
                        ล้างตัวกรองทั้งหมด
                    </button>
                )}
            </div>
        </div>
    );
}
