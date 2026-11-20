'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { formatDate } from '@/lib/utils';
import {
    getVendorCustomerReport,
    getVendorCustomerReportOptions,
} from '@/app/actions/reports';
import {
    VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE,
    type VendorCustomerReportOptions,
    type VendorCustomerReportResponse,
    type VendorPromoSubView,
} from '@/types/vendor-customer-report';
import VendorCustomerFilterBar from './VendorCustomerFilterBar';
import VendorCustomerKpiCards from './VendorCustomerKpiCards';
import VendorCustomerRankingTable from './VendorCustomerRankingTable';

const DEBOUNCE_MS = 300;

interface VendorCustomerPromoSectionProps {
    dateFrom: string;
    dateTo: string;
}

export default function VendorCustomerPromoSection({
    dateFrom,
    dateTo,
}: VendorCustomerPromoSectionProps) {
    const [options, setOptions] = useState<VendorCustomerReportOptions>({
        vendors: [],
        brands: [],
    });
    const [vendorId, setVendorId] = useState('');
    const [brand, setBrand] = useState('');
    const [subView, setSubView] = useState<VendorPromoSubView>('customers');
    const [excludeWalkIn, setExcludeWalkIn] = useState(false);

    const [customerSearchInput, setCustomerSearchInput] = useState('');
    const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
    const [minSpendInput, setMinSpendInput] = useState('');
    const [debouncedMinSpend, setDebouncedMinSpend] = useState(0);
    const [minQuantityInput, setMinQuantityInput] = useState('');
    const [debouncedMinQuantity, setDebouncedMinQuantity] = useState(0);

    const [page, setPage] = useState(1);
    const [reportData, setReportData] = useState<VendorCustomerReportResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    const reqSeqRef = useRef(0);

    // Load Vendor & Brand options once on mount
    useEffect(() => {
        let active = true;
        getVendorCustomerReportOptions()
            .then((opts) => {
                if (active) setOptions(opts);
            })
            .catch((err) => console.error('Failed to load vendor customer options:', err));
        return () => {
            active = false;
        };
    }, []);

    // Debounce text & numeric inputs
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCustomerSearch(customerSearchInput);
            setDebouncedMinSpend(Math.max(0, Number(minSpendInput) || 0));
            setDebouncedMinQuantity(Math.max(0, Number(minQuantityInput) || 0));
            setPage(1);
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [customerSearchInput, minSpendInput, minQuantityInput]);

    // Reset page when discrete filters change
    useEffect(() => {
        setPage(1);
    }, [dateFrom, dateTo, vendorId, brand, excludeWalkIn, subView]);

    const loadReport = useCallback(async () => {
        if (!vendorId && !brand) {
            setReportData(null);
            setLoading(false);
            return;
        }
        const seq = ++reqSeqRef.current;
        setLoading(true);
        try {
            const res = await getVendorCustomerReport({
                dateFrom,
                dateTo,
                vendorId,
                brand,
                customerSearch: debouncedCustomerSearch,
                minSpend: debouncedMinSpend,
                minQuantity: debouncedMinQuantity,
                excludeWalkIn,
                subView,
                page,
                pageSize: VENDOR_CUSTOMER_DEFAULT_PAGE_SIZE,
            });
            if (seq === reqSeqRef.current) {
                setReportData(res);
            }
        } catch (err) {
            console.error('Failed to load vendor customer report:', err);
        } finally {
            if (seq === reqSeqRef.current) {
                setLoading(false);
            }
        }
    }, [
        dateFrom,
        dateTo,
        vendorId,
        brand,
        debouncedCustomerSearch,
        debouncedMinSpend,
        debouncedMinQuantity,
        excludeWalkIn,
        subView,
        page,
    ]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const hasActiveFilters = Boolean(
        vendorId ||
            brand ||
            customerSearchInput.trim() ||
            minSpendInput.trim() ||
            minQuantityInput.trim() ||
            excludeWalkIn
    );

    const handleReset = () => {
        setVendorId('');
        setBrand('');
        setCustomerSearchInput('');
        setDebouncedCustomerSearch('');
        setMinSpendInput('');
        setDebouncedMinSpend(0);
        setMinQuantityInput('');
        setDebouncedMinQuantity(0);
        setExcludeWalkIn(false);
        setPage(1);
    };

    const handleExportExcel = async () => {
        if (!vendorId && !brand) return;
        setExporting(true);
        try {
            const fullData = await getVendorCustomerReport({
                dateFrom,
                dateTo,
                vendorId,
                brand,
                customerSearch: debouncedCustomerSearch,
                minSpend: debouncedMinSpend,
                minQuantity: debouncedMinQuantity,
                excludeWalkIn,
                exportAll: true,
            });

            const wb = XLSX.utils.book_new();
            const vendorLabel =
                options.vendors.find((v) => v.id === vendorId)?.name || brand || 'all';
            const safeLabel = vendorLabel.replace(/[\\/:*?"<>|]/g, '_');
            const periodLabel = `${dateFrom || 'all'}_${dateTo || 'all'}`;

            const customerSheetRows = (fullData.customers?.rows || []).map((c) => ({
                'อันดับ': c.rank,
                'ชื่อลูกค้า': c.customerName,
                'เบอร์โทร': c.phone || '-',
                'กลุ่มลูกค้า': c.customerGroupName,
                'แต้มสะสมปัจจุบัน': c.totalPoints,
                'จำนวนบิลที่ซื้อ': c.billCount,
                'จำนวนรายการสินค้า': c.distinctProductCount,
                'จำนวนหน่วยซื้อสุทธิ': c.totalBaseQuantity,
                'ยอดซื้อสุทธิ (บาท)': c.netSales,
                'สัดส่วนยอดซื้อ (%)': c.salesSharePct,
                'กำไรขั้นต้น (บาท)': c.grossProfit,
                'ซื้อล่าสุด': formatDate(c.lastPurchaseAt),
            }));

            const detailSheetRows = (fullData.exportDetails || []).map((d) => ({
                'อันดับลูกค้า': d.rank,
                'ชื่อลูกค้า': d.customerName,
                'เบอร์โทร': d.phone,
                'กลุ่มลูกค้า': d.customerGroupName,
                'รหัสสินค้า': d.productCode,
                'ชื่อสินค้า': d.productName,
                'ผู้ขายที่เคยส่งสินค้านี้': d.sourcedVendors,
                'จำนวนบิล': d.billCount,
                'จำนวนซื้อสุทธิ': d.totalBaseQuantity,
                'หน่วย': d.baseUnit,
                'ยอดซื้อสุทธิ (บาท)': d.netSales,
                'กำไรขั้นต้น (บาท)': d.grossProfit,
            }));

            const productSheetRows = (fullData.products?.rows || []).map((p) => ({
                'รหัสสินค้า': p.productCode,
                'ชื่อสินค้า': p.productName,
                'ยี่ห้อ': p.brand || '-',
                'ผู้ขายที่เคยส่งสินค้านี้': p.sourcedVendors.join(', ') || '-',
                'จำนวนลูกค้าที่ซื้อ': p.buyerCount,
                'จำนวนบิล': p.billCount,
                'จำนวนขายสุทธิ': p.totalBaseQuantity,
                'หน่วย': p.baseUnit,
                'ยอดขายสุทธิ (บาท)': p.netSales,
                'ต้นทุนขาย (บาท)': p.cogs,
                'กำไรขั้นต้น (บาท)': p.grossProfit,
            }));

            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(customerSheetRows),
                'อันดับลูกค้ารับโปร'
            );
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(detailSheetRows),
                'รายละเอียดรายลูกค้า'
            );
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(productSheetRows),
                'สรุปสินค้าที่ขายออก'
            );

            XLSX.writeFile(wb, `ลูกค้าตามผู้ขาย_${safeLabel}_${periodLabel}.xlsx`);
        } catch (err) {
            console.error('Failed to export vendor customer report:', err);
        } finally {
            setExporting(false);
        }
    };

    const isReadyToDisplay = Boolean(vendorId || brand);

    return (
        <div className="space-y-4">
            <VendorCustomerFilterBar
                vendors={options.vendors}
                brands={options.brands}
                vendorId={vendorId}
                brand={brand}
                customerSearchInput={customerSearchInput}
                minSpendInput={minSpendInput}
                minQuantityInput={minQuantityInput}
                excludeWalkIn={excludeWalkIn}
                onVendorChange={setVendorId}
                onBrandChange={setBrand}
                onCustomerSearchChange={setCustomerSearchInput}
                onMinSpendChange={setMinSpendInput}
                onMinQuantityChange={setMinQuantityInput}
                onExcludeWalkInChange={setExcludeWalkIn}
                onReset={handleReset}
                hasActiveFilters={hasActiveFilters}
            />

            {!isReadyToDisplay ? (
                <div className="bg-white rounded-xl border border-dashed border-emerald-200 p-10 text-center">
                    <p className="text-2xl mb-2">🎯</p>
                    <h3 className="text-base font-semibold text-gray-800">
                        เลือกผู้ขาย (Vendor) หรือยี่ห้อสินค้า เพื่อจัดอันดับลูกค้า
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-lg mx-auto">
                        ระบบจะค้นหาสินค้าทั้งหมดที่เคยรับเข้าจากผู้ขายเจ้านั้น แล้วคำนวณยอดซื้อสุทธิแยกรายลูกค้าให้อัตโนมัติ
                        พร้อมตัวช่วยคัดเกณฑ์ยอดซื้อขั้นต่ำสำหรับจัดโปรโมชั่น
                    </p>
                </div>
            ) : loading && !reportData ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
            ) : reportData ? (
                <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
                    <VendorCustomerKpiCards summary={reportData.summary} />

                    {/* Sub-view switcher & Export button */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                            {(
                                [
                                    { key: 'customers', label: '🏆 อันดับลูกค้า' },
                                    { key: 'products', label: '📦 สินค้าของผู้ขายนี้ที่ขายออก' },
                                ] as const
                            ).map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setSubView(tab.key)}
                                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                        subView === tab.key
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={exporting || loading || reportData.summary.qualifiedCustomerCount === 0}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-all"
                        >
                            {exporting ? '⏳ กำลังสร้างไฟล์ Excel...' : '📥 Export รายชื่อทำโปร (.xlsx)'}
                        </button>
                    </div>

                    <VendorCustomerRankingTable
                        subView={subView}
                        customers={reportData.customers}
                        products={reportData.products}
                        drilldownFilters={{
                            dateFrom,
                            dateTo,
                            vendorId,
                            brand,
                        }}
                        onPageChange={setPage}
                    />
                </div>
            ) : null}
        </div>
    );
}
