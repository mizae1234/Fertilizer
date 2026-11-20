'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type {
    GrDateField,
    GrFilterOption,
    GrPaymentStatusFilter,
} from '@/types/goods-receive-report';

interface GoodsReceiveFilterBarProps {
    vendors: GrFilterOption[];
    warehouses: GrFilterOption[];
    vendorId: string;
    warehouseId: string;
    paymentStatus: GrPaymentStatusFilter;
    dateField: GrDateField;
    productSearchInput: string;
    docSearchInput: string;
    onVendorChange: (id: string) => void;
    onWarehouseChange: (id: string) => void;
    onPaymentStatusChange: (status: GrPaymentStatusFilter) => void;
    onDateFieldChange: (field: GrDateField) => void;
    onProductSearchChange: (val: string) => void;
    onDocSearchChange: (val: string) => void;
    onReset: () => void;
    hasActiveFilters: boolean;
}

export default function GoodsReceiveFilterBar({
    vendors,
    warehouses,
    vendorId,
    warehouseId,
    paymentStatus,
    dateField,
    productSearchInput,
    docSearchInput,
    onVendorChange,
    onWarehouseChange,
    onPaymentStatusChange,
    onDateFieldChange,
    onProductSearchChange,
    onDocSearchChange,
    onReset,
    hasActiveFilters,
}: GoodsReceiveFilterBarProps) {
    const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
    const [vendorQuery, setVendorQuery] = useState('');
    const vendorPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (vendorPickerRef.current && !vendorPickerRef.current.contains(e.target as Node)) {
                setVendorDropdownOpen(false);
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
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Searchable Vendor Combobox */}
                <div ref={vendorPickerRef} className={`relative ${vendorDropdownOpen ? 'z-40' : ''}`}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        🏢 บริษัทผู้ขาย (Supplier)
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setVendorDropdownOpen((prev) => !prev);
                            setVendorQuery('');
                        }}
                        className={`w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center justify-between gap-2 transition-colors ${
                            vendorId
                                ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900 font-medium'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <span className="truncate">
                            {selectedVendor ? selectedVendor.name : 'ทุกบริษัทผู้ขาย'}
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
                                    title="ล้างตัวกรองบริษัท"
                                >
                                    ✕
                                </span>
                            )}
                            <span className="text-gray-400 text-xs">▼</span>
                        </div>
                    </button>

                    {vendorDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                            <div className="p-2 border-b border-gray-100">
                                <input
                                    type="text"
                                    value={vendorQuery}
                                    onChange={(e) => setVendorQuery(e.target.value)}
                                    placeholder="พิมพ์ค้นหาชื่อบริษัท..."
                                    autoFocus
                                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                                />
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onVendorChange('');
                                        setVendorDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 ${
                                        !vendorId ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-gray-600'
                                    }`}
                                >
                                    🏢 ทุกบริษัทผู้ขาย ({vendors.length} บริษัท)
                                </button>
                                {filteredVendors.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-gray-400 text-center">
                                        ไม่พบบริษัทที่ค้นหา
                                    </p>
                                ) : (
                                    filteredVendors.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => {
                                                onVendorChange(v.id);
                                                setVendorDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 ${
                                                vendorId === v.id
                                                    ? 'bg-emerald-50 font-semibold text-emerald-700'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            {v.name}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Product Search */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        📦 ค้นหาสินค้า (ชื่อ / รหัส / บาร์โค้ด)
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={productSearchInput}
                            onChange={(e) => onProductSearchChange(e.target.value)}
                            placeholder="เช่น ยูเรีย, 46-0-0, 00015..."
                            className="w-full px-3 py-2 pr-7 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                        />
                        {productSearchInput && (
                            <button
                                type="button"
                                onClick={() => onProductSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 text-xs"
                                title="ล้างคำค้นหาสินค้า"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* 3. Warehouse Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        🏭 คลังสินค้าที่รับเข้า
                    </label>
                    <select
                        value={warehouseId}
                        onChange={(e) => onWarehouseChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                    >
                        <option value="">ทุกคลังสินค้า</option>
                        {warehouses.map((wh) => (
                            <option key={wh.id} value={wh.id}>
                                {wh.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 4. Document Search (GR / PO) */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        🧾 ค้นหาเลข GR / PO / หมายเหตุ
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={docSearchInput}
                            onChange={(e) => onDocSearchChange(e.target.value)}
                            placeholder="เช่น GR-2026, PO..."
                            className="w-full px-3 py-2 pr-7 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                        />
                        {docSearchInput && (
                            <button
                                type="button"
                                onClick={() => onDocSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 text-xs"
                                title="ล้างคำค้นหาเลขเอกสาร"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Secondary Filter Row: Payment Status + Date Basis + Reset */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">สถานะค่าสินค้า:</span>
                        {(
                            [
                                { key: 'ALL', label: 'ทั้งหมด' },
                                { key: 'PAID', label: '✅ จ่ายแล้ว' },
                                { key: 'UNPAID', label: '⏳ ค้างจ่าย' },
                            ] as const
                        ).map((opt) => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => onPaymentStatusChange(opt.key)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                    paymentStatus === opt.key
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">อ้างอิงช่วงเวลา:</span>
                        <select
                            value={dateField}
                            onChange={(e) => onDateFieldChange(e.target.value as GrDateField)}
                            className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs bg-white text-gray-700 focus:outline-none"
                        >
                            <option value="receivedDate">วันที่รับสินค้า</option>
                            <option value="createdAt">วันที่บันทึกบิล</option>
                        </select>
                    </div>
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                    >
                        ล้างตัวกรองย่อยทั้งหมด
                    </button>
                )}
            </div>
        </div>
    );
}
