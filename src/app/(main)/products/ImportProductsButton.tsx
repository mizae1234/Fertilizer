'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportProductsButton() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleDownloadTemplate = () => {
        window.location.href = '/api/products/import-template';
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setResult(null);

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
                if (data.created > 0) {
                    router.refresh();
                }
            }
        } catch (err) {
            setResult({ created: 0, skipped: 0, errors: ['ไม่สามารถอัปโหลดไฟล์ได้'] });
        } finally {
            setLoading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="relative">
            <div className="flex gap-1">
                <button
                    onClick={handleDownloadTemplate}
                    className="px-3 py-2.5 rounded-l-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                    title="ดาวน์โหลด Template"
                >
                    📄
                </button>
                <label className={`px-3 py-2.5 rounded-r-xl border border-l-0 border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImport}
                        className="hidden"
                        disabled={loading}
                    />
                    {loading ? '⏳ กำลังนำเข้า...' : '📤 Import Excel'}
                </label>
            </div>

            {result && (
                <div className="absolute right-0 top-12 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 min-w-[280px] animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm text-gray-800">ผลการนำเข้า</h4>
                        <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                    </div>
                    <div className="space-y-1 text-sm">
                        {result.created > 0 && (
                            <div className="text-emerald-600">✅ สร้างสำเร็จ: {result.created} รายการ</div>
                        )}
                        {result.skipped > 0 && (
                            <div className="text-amber-600">⚠️ ข้าม: {result.skipped} รายการ</div>
                        )}
                        {result.errors.length > 0 && (
                            <div className="mt-2 max-h-32 overflow-y-auto">
                                {result.errors.map((err, i) => (
                                    <div key={i} className="text-xs text-red-500 py-0.5">{err}</div>
                                ))}
                            </div>
                        )}
                        {result.created === 0 && result.skipped === 0 && result.errors.length === 0 && (
                            <div className="text-gray-400">ไม่มีข้อมูลในไฟล์</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
