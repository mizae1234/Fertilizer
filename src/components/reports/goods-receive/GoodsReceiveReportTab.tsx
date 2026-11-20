'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { formatDate } from '@/lib/utils';
import {
    getGoodsReceiveReport,
    getGoodsReceiveReportOptions,
} from '@/app/actions/reports';
import {
    GR_REPORT_DEFAULT_PAGE_SIZE,
    type GoodsReceiveReportOptions,
    type GoodsReceiveReportResponse,
    type GrDateField,
    type GrPaymentStatusFilter,
    type GrReportViewMode,
} from '@/types/goods-receive-report';
import GoodsReceiveFilterBar from './GoodsReceiveFilterBar';
import GoodsReceiveKpiSummary from './GoodsReceiveKpiSummary';
import GoodsReceiveItemsView from './GoodsReceiveItemsView';
import GoodsReceiveVendorsView from './GoodsReceiveVendorsView';
import GoodsReceiveBillsView from './GoodsReceiveBillsView';

const SEARCH_DEBOUNCE_MS = 300;

interface GoodsReceiveReportTabProps {
    dateFrom: string;
    dateTo: string;
}

export default function GoodsReceiveReportTab({
    dateFrom,
    dateTo,
}: GoodsReceiveReportTabProps) {
    const [options, setOptions] = useState<GoodsReceiveReportOptions>({
        vendors: [],
        warehouses: [],
    });
    const [view, setView] = useState<GrReportViewMode>('items');
    const [vendorId, setVendorId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<GrPaymentStatusFilter>('ALL');
    const [dateField, setDateField] = useState<GrDateField>('receivedDate');

    // Immediate inputs vs debounced query values for responsive typing
    const [productSearchInput, setProductSearchInput] = useState('');
    const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
    const [docSearchInput, setDocSearchInput] = useState('');
    const [debouncedDocSearch, setDebouncedDocSearch] = useState('');

    const [page, setPage] = useState(1);
    const [productSummaryPage, setProductSummaryPage] = useState(1);
    const [reportData, setReportData] = useState<GoodsReceiveReportResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const requestSeqRef = useRef(0);

    // Load dropdown metadata once on mount
    useEffect(() => {
        let mounted = true;
        getGoodsReceiveReportOptions()
            .then((opts) => {
                if (mounted) setOptions(opts);
            })
            .catch((err) => console.error('Failed to load GR report options:', err));
        return () => {
            mounted = false;
        };
    }, []);

    // Debounce product search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedProductSearch(productSearchInput);
            setPage(1);
            setProductSummaryPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [productSearchInput]);

    // Debounce document search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedDocSearch(docSearchInput);
            setPage(1);
            setProductSummaryPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [docSearchInput]);

    // Reset pagination when primary filters change
    useEffect(() => {
        setPage(1);
        setProductSummaryPage(1);
    }, [dateFrom, dateTo, vendorId, warehouseId, paymentStatus, dateField, view]);

    const fetchReport = useCallback(async () => {
        const seq = ++requestSeqRef.current;
        setLoading(true);
        try {
            const res = await getGoodsReceiveReport({
                dateFrom,
                dateTo,
                dateField,
                vendorId,
                warehouseId,
                paymentStatus,
                productSearch: debouncedProductSearch,
                docSearch: debouncedDocSearch,
                view,
                page,
                productSummaryPage,
                pageSize: GR_REPORT_DEFAULT_PAGE_SIZE,
            });
            if (seq === requestSeqRef.current) {
                setReportData(res);
            }
        } catch (err) {
            console.error('Failed to load GR report:', err);
        } finally {
            if (seq === requestSeqRef.current) {
                setLoading(false);
            }
        }
    }, [
        dateFrom,
        dateTo,
        dateField,
        vendorId,
        warehouseId,
        paymentStatus,
        debouncedProductSearch,
        debouncedDocSearch,
        view,
        page,
        productSummaryPage,
    ]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const hasActiveFilters = Boolean(
        vendorId ||
            warehouseId ||
            paymentStatus !== 'ALL' ||
            dateField !== 'receivedDate' ||
            productSearchInput.trim() ||
            docSearchInput.trim()
    );

    const handleResetFilters = () => {
        setVendorId('');
        setWarehouseId('');
        setPaymentStatus('ALL');
        setDateField('receivedDate');
        setProductSearchInput('');
        setDebouncedProductSearch('');
        setDocSearchInput('');
        setDebouncedDocSearch('');
        setPage(1);
        setProductSummaryPage(1);
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const fullData = await getGoodsReceiveReport({
                dateFrom,
                dateTo,
                dateField,
                vendorId,
                warehouseId,
                paymentStatus,
                productSearch: debouncedProductSearch,
                docSearch: debouncedDocSearch,
                view,
                exportAll: true,
            });

            const wb = XLSX.utils.book_new();
            const periodLabel = `${dateFrom || 'all'}_${dateTo || 'all'}`;

            if (view === 'items') {
                const rollupRows = (fullData.productRollup?.rows || []).map((p) => ({
                    'รหัสสินค้า': p.productCode,
                    'ชื่อสินค้า': p.productName,
                    'เลข PO': p.poNumbers.length > 0 ? p.poNumbers.join(', ') : '-',
                    'จำนวนครั้งที่รับ': p.receiveCount,
                    'จำนวนบริษัท': p.vendorCount,
                    'จำนวนรับรวม': p.totalQuantity,
                    'หน่วย': p.unit,
                    'ทุนเฉลี่ยก่อนลด/หน่วย': p.avgGrossUnitCost,
                    'ทุนสุทธิเฉลี่ย/หน่วย': p.avgNetUnitCost,
                    'ส่วนลดท้ายบิลเฉลี่ยรวม': p.discountShare,
                    'มูลค่าซื้อสุทธิรวม': p.netTotal,
                }));
                const detailRows = (fullData.items?.rows || []).map((r) => ({
                    'วันที่': formatDate(r.date),
                    'เลขที่ GR': r.grNumber,
                    'เลข PO': r.poNumber || '-',
                    'บริษัทผู้ขาย': r.vendorName,
                    'รหัสสินค้า': r.productCode,
                    'ชื่อสินค้า': r.productName,
                    'คลังที่รับ': r.warehouseName,
                    'Lot': r.lotNo || '-',
                    'จำนวน': r.quantity,
                    'หน่วย': r.unit,
                    'ทุน/หน่วย (ก่อนลด)': r.grossUnitCost,
                    'ทุนสุทธิ/หน่วย (หลังหักส่วนลด)': r.netUnitCost,
                    'ยอดก่อนลด': r.grossTotal,
                    'ส่วนลดเฉลี่ย': r.discountShare,
                    'ยอดสุทธิ': r.netTotal,
                    'สถานะค่าสินค้า': r.goodsPaid ? 'จ่ายแล้ว' : 'ค้างจ่าย',
                }));

                XLSX.utils.book_append_sheet(
                    wb,
                    XLSX.utils.json_to_sheet(rollupRows),
                    'สรุปรวมตามสินค้า'
                );
                XLSX.utils.book_append_sheet(
                    wb,
                    XLSX.utils.json_to_sheet(detailRows),
                    'รายละเอียดรายรายการ'
                );
                XLSX.writeFile(wb, `รายงานรับสินค้าเข้า_รายสินค้า_${periodLabel}.xlsx`);
            } else if (view === 'vendors') {
                const vendorRows = (fullData.vendors?.rows || []).map((v) => ({
                    'บริษัทผู้ขาย': v.vendorName,
                    'เลข PO': v.poNumbers.length > 0 ? v.poNumbers.join(', ') : '-',
                    'จำนวนบิล': v.billCount,
                    'จำนวนรายการ': v.itemLineCount,
                    'จำนวนหน่วยรวม': v.totalQuantity,
                    'ยอดก่อนลด': v.grossAmount,
                    'ส่วนลดท้ายบิลรวม': v.discountAmount,
                    'ยอดซื้อสุทธิ': v.netAmount,
                    'ยอดจ่ายแล้ว': v.paidNetAmount,
                    'ยอดค้างจ่าย': v.unpaidNetAmount,
                    'จำนวนบิลค้างจ่าย': v.unpaidBillCount,
                    'ค่ารถขนส่งรวม': v.shippingTotal,
                    'ค่าลงสินค้ารวม': v.unloadingTotal,
                }));
                XLSX.utils.book_append_sheet(
                    wb,
                    XLSX.utils.json_to_sheet(vendorRows),
                    'สรุปตามบริษัทผู้ขาย'
                );
                XLSX.writeFile(wb, `รายงานรับสินค้าเข้า_ตามบริษัท_${periodLabel}.xlsx`);
            } else {
                const billRows = (fullData.bills?.rows || []).map((b) => ({
                    'เลขที่ GR': b.grNumber,
                    'เลข PO': b.poNumber || '-',
                    'วันที่รับสินค้า': formatDate(b.receivedDate),
                    'บริษัทผู้ขาย': b.vendorName,
                    'ผู้บันทึก': b.createdByName,
                    'จำนวนรายการ': b.itemCount,
                    'จำนวนหน่วยรวม': b.totalQuantity,
                    'รายการสินค้า': b.itemsPreview,
                    'ยอดก่อนลด': b.grossAmount,
                    'ส่วนลดท้ายบิล': b.discountAmount,
                    'ยอดสุทธิ': b.netAmount,
                    'สถานะค่าสินค้า': b.goodsPaid ? 'จ่ายแล้ว' : 'ค้างจ่าย',
                    'ค่ารถขนส่ง': b.shippingCost,
                    'สถานะค่ารถ': b.shippingPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย',
                    'ค่าลงสินค้า': b.unloadingCost,
                    'สถานะค่าลง': b.unloadingPaid ? 'จ่ายแล้ว' : 'ยังไม่จ่าย',
                }));
                XLSX.utils.book_append_sheet(
                    wb,
                    XLSX.utils.json_to_sheet(billRows),
                    'รายบิลรับสินค้า'
                );
                XLSX.writeFile(wb, `รายงานรับสินค้าเข้า_รายบิล_${periodLabel}.xlsx`);
            }
        } catch (err) {
            console.error('Failed to export GR report:', err);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <GoodsReceiveFilterBar
                vendors={options.vendors}
                warehouses={options.warehouses}
                vendorId={vendorId}
                warehouseId={warehouseId}
                paymentStatus={paymentStatus}
                dateField={dateField}
                productSearchInput={productSearchInput}
                docSearchInput={docSearchInput}
                onVendorChange={setVendorId}
                onWarehouseChange={setWarehouseId}
                onPaymentStatusChange={setPaymentStatus}
                onDateFieldChange={setDateField}
                onProductSearchChange={setProductSearchInput}
                onDocSearchChange={setDocSearchInput}
                onReset={handleResetFilters}
                hasActiveFilters={hasActiveFilters}
            />

            {/* View Switcher & Excel Export */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                    {(
                        [
                            { key: 'items', label: '📦 รายสินค้า' },
                            { key: 'vendors', label: '🏢 สรุปตามบริษัทผู้ขาย' },
                            { key: 'bills', label: '🧾 รายบิล GR' },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setView(tab.key)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                                view === tab.key
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
                    disabled={exporting || loading}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-all"
                >
                    {exporting ? '⏳ กำลังสร้างไฟล์ Excel...' : '📥 Export Excel (.xlsx)'}
                </button>
            </div>

            {/* KPI Summary + Active Table View */}
            {loading && !reportData ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
            ) : reportData ? (
                <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
                    <GoodsReceiveKpiSummary summary={reportData.summary} />

                    {view === 'items' && reportData.items && reportData.productRollup && (
                        <GoodsReceiveItemsView
                            items={reportData.items}
                            productRollup={reportData.productRollup}
                            onPageChange={setPage}
                            onProductRollupPageChange={setProductSummaryPage}
                            onQuickFilterProduct={(code) => {
                                setProductSearchInput(code);
                                setDebouncedProductSearch(code);
                                setPage(1);
                                setProductSummaryPage(1);
                            }}
                        />
                    )}

                    {view === 'vendors' && reportData.vendors && (
                        <GoodsReceiveVendorsView
                            vendors={reportData.vendors}
                            activeFilters={{
                                dateFrom,
                                dateTo,
                                dateField,
                                warehouseId,
                                paymentStatus,
                                productSearch: debouncedProductSearch,
                                docSearch: debouncedDocSearch,
                            }}
                            onPageChange={setPage}
                            onSelectVendorFilter={(selectedId) => {
                                setVendorId(selectedId);
                                setView('items');
                                setPage(1);
                            }}
                        />
                    )}

                    {view === 'bills' && reportData.bills && (
                        <GoodsReceiveBillsView
                            bills={reportData.bills}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            ) : null}
        </div>
    );
}
