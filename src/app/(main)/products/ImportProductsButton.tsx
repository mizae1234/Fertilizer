'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

interface PreviewRow {
    code: string;
    name: string;
    description: string;
    unit: string;
    pointsPerUnit: number;
    minStock: number;
    brand: string;
    cost: number;
    price: number;
    packaging: string;
}

export default function ImportProductsButton() {
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<PreviewRow[] | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleDownloadTemplate = () => {
        window.location.href = '/api/products/import-template';
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setResult(null);

        try {
            const buffer = await f.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (rows.length < 2) {
                setPreview([]);
                return;
            }

            // Find header row
            const fieldNames = ['code', 'name', 'description', 'unit', 'pointsPerUnit', 'minStock', 'brand', 'cost', 'price', 'packaging'];
            let headerRowIdx = 0;
            for (let i = 0; i < Math.min(rows.length, 5); i++) {
                const row = rows[i].map((c: any) => String(c).trim().toLowerCase());
                if (row.includes('code') && row.includes('name')) {
                    headerRowIdx = i;
                    break;
                }
            }

            const headerRow = rows[headerRowIdx].map((c: any) => String(c).trim().toLowerCase());
            const colMap: Record<string, number> = {};
            for (const field of fieldNames) {
                const idx = headerRow.indexOf(field.toLowerCase());
                if (idx !== -1) colMap[field] = idx;
            }

            const dataRows = rows.slice(headerRowIdx + 1);
            const parsed: PreviewRow[] = [];

            for (const row of dataRows) {
                if (!row || row.length === 0) continue;
                const getValue = (field: string) => {
                    const idx = colMap[field];
                    if (idx === undefined || idx >= row.length) return '';
                    const val = row[idx];
                    return val !== undefined && val !== null ? String(val).trim() : '';
                };

                const name = getValue('name');
                if (!name) continue;

                parsed.push({
                    code: getValue('code'),
                    name,
                    description: getValue('description'),
                    unit: getValue('unit') || 'ชิ้น',
                    pointsPerUnit: parseInt(getValue('pointsPerUnit') || '0') || 0,
                    minStock: parseInt(getValue('minStock') || '10') || 10,
                    brand: getValue('brand'),
                    cost: parseFloat(getValue('cost') || '0') || 0,
                    price: parseFloat(getValue('price') || '0') || 0,
                    packaging: getValue('packaging'),
                });
            }

            setPreview(parsed);
        } catch {
            setPreview([]);
        }
    };

    const handleConfirmImport = async () => {
        if (!file) return;
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/products/import', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (!res.ok) {
                setResult({ created: 0, skipped: 0, errors: [data.error || 'เกิดข้อผิดพลาด'] });
            } else {
                setResult(data);
                if (data.created > 0) router.refresh();
            }
        } catch {
            setResult({ created: 0, skipped: 0, errors: ['ไม่สามารถอัปโหลดไฟล์ได้'] });
        } finally {
            setLoading(false);
            setPreview(null);
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleCancel = () => {
        setPreview(null);
        setFile(null);
        setResult(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    return (
        <>
            <div className="relative">
                <div className="flex gap-1">
                    <button
                        onClick={handleDownloadTemplate}
                        className="px-3 py-2.5 rounded-l-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                        title="ดาวน์โหลด Template สำหรับนำเข้าสินค้า"
                    >
                        📄 Template
                    </button>
                    <label className={`px-3 py-2.5 rounded-r-xl border border-l-0 border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={loading}
                        />
                        {loading ? '⏳ กำลังนำเข้า...' : '📤 Import Excel'}
                    </label>
                </div>

                {/* Result popup */}
                {result && !preview && (
                    <div className="absolute right-0 top-12 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 min-w-[280px] animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm text-gray-800">ผลการนำเข้า</h4>
                            <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        </div>
                        <div className="space-y-1 text-sm">
                            {result.created > 0 && <div className="text-emerald-600">✅ สร้างสำเร็จ: {result.created} รายการ</div>}
                            {result.skipped > 0 && <div className="text-amber-600">⚠️ ข้าม: {result.skipped} รายการ</div>}
                            {result.errors.length > 0 && (
                                <div className="mt-2 max-h-32 overflow-y-auto">
                                    {result.errors.map((err, i) => (
                                        <div key={i} className="text-xs text-red-500 py-0.5">{err}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {preview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={handleCancel}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">ตรวจสอบข้อมูลก่อนนำเข้า</h3>
                                <p className="text-sm text-gray-500">พบ {preview.length} รายการ จากไฟล์ {file?.name}</p>
                            </div>
                            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto px-2">
                            {preview.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">ไม่พบข้อมูลในไฟล์</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">รหัส</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">ชื่อสินค้า</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">หน่วย</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">ยี่ห้อ</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">ทุน</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">ราคาขาย</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">บรรจุภัณฑ์</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">แต้ม</th>
                                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">สต็อกขั้นต่ำ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {preview.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                                <td className="px-3 py-2 font-mono text-gray-600">{row.code || <span className="text-gray-300 italic">อัตโนมัติ</span>}</td>
                                                <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                                                <td className="px-3 py-2 text-gray-600">{row.unit}</td>
                                                <td className="px-3 py-2 text-gray-600">{row.brand || '-'}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{row.cost.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right font-semibold text-gray-800">{row.price.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-gray-600">{row.packaging || '-'}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{row.pointsPerUnit}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{row.minStock}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                            <button onClick={handleCancel} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
                                ยกเลิก
                            </button>
                            {preview.length > 0 && (
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={loading}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md disabled:opacity-50"
                                >
                                    {loading ? '⏳ กำลังนำเข้า...' : `✅ ยืนยันนำเข้า ${preview.length} รายการ`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
