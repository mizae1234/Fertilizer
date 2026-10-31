'use client';

import { formatCurrency } from '@/lib/utils';

interface ShiftBadgeProps {
    enabled: boolean;
    currentShift: any | null;
    onOpenShift: () => void;
    onCloseShift: () => void;
}

export default function ShiftBadge({
    enabled,
    currentShift,
    onOpenShift,
    onCloseShift,
}: ShiftBadgeProps) {
    if (!enabled) return null;

    if (currentShift) {
        const openedTime = new Date(currentShift.openedAt).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
        });

        return (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-1.5 shadow-sm">
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <div className="text-xs">
                        <span className="font-bold text-emerald-800">{currentShift.shiftNumber}</span>
                        <span className="text-emerald-600 ml-1.5 hidden sm:inline">
                            (เปิด {openedTime} • ทอน {formatCurrency(currentShift.startingCash)})
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onCloseShift}
                    className="ml-1 px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-xs transition-colors"
                >
                    🔒 ปิดกะ
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                <span>⚠️</span> ยังไม่ได้เปิดกะ
            </span>
            <button
                type="button"
                onClick={onOpenShift}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-colors"
            >
                ⏰ เปิดกะ
            </button>
        </div>
    );
}
