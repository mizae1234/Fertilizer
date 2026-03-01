'use client';

import { useEffect } from 'react';

export default function MainError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-gray-500 max-w-md">
                ขออภัย เกิดข้อผิดพลาดขึ้นระหว่างดำเนินการ กรุณาลองใหม่อีกครั้ง
            </p>
            {error.message && (
                <p className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-xl max-w-md break-all">
                    {error.message}
                </p>
            )}
            <div className="flex gap-3 mt-2">
                <button
                    onClick={reset}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 transition-all"
                >
                    🔄 ลองอีกครั้ง
                </button>
                <a
                    href="/"
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-all"
                >
                    🏠 กลับหน้าหลัก
                </a>
            </div>
        </div>
    );
}
