'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    getShiftConfig,
    getCurrentShift,
    openShift as openShiftAction,
    closeShift as closeShiftAction,
} from '@/app/actions/shifts';

export function useShift(userId?: string) {
    const [enabled, setEnabled] = useState(false);
    const [currentShift, setCurrentShift] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);

    const refreshShift = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const config = await getShiftConfig();
            setEnabled(config.enabled);

            if (config.enabled) {
                const shift = await getCurrentShift(userId);
                setCurrentShift(shift);
            } else {
                setCurrentShift(null);
            }
        } catch (err) {
            console.error('Failed to load shift status:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        refreshShift();
    }, [refreshShift]);

    const handleOpenShift = async (startingCash: number, notes?: string) => {
        if (!userId) throw new Error('ไม่พบข้อมูลผู้ใช้');
        const res = await openShiftAction({ userId, startingCash, notes });
        setCurrentShift(res);
        setShowOpenModal(false);
        return res;
    };

    const handleCloseShift = async (data: { shiftId: string; closingCash?: number; notes?: string }) => {
        const res = await closeShiftAction(data);
        setCurrentShift(null);
        setShowCloseModal(false);
        return res;
    };

    return {
        enabled,
        currentShift,
        loading,
        showOpenModal,
        setShowOpenModal,
        showCloseModal,
        setShowCloseModal,
        handleOpenShift,
        handleCloseShift,
        refreshShift,
    };
}
