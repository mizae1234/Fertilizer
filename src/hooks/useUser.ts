'use client';

import { useState, useEffect } from 'react';

interface UserInfo {
    userId: string;
    username: string;
    name: string;
    role: 'ADMIN' | 'STAFF';
    allowedMenus: string[] | null;
    defaultWarehouseId: string | null;
}

export function useUser(): UserInfo | null {
    const [user, setUser] = useState<UserInfo | null>(null);

    useEffect(() => {
        try {
            const cookie = document.cookie.split(';').find(c => c.trim().startsWith('token='));
            if (cookie) {
                const token = cookie.split('=')[1];
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUser({
                    userId: payload.userId || '',
                    username: payload.username || '',
                    name: payload.name || '',
                    role: payload.role || 'STAFF',
                    allowedMenus: payload.allowedMenus || null,
                    defaultWarehouseId: payload.defaultWarehouseId || null,
                });
            }
        } catch { }
    }, []);

    return user;
}

export function isAdmin(role?: string): boolean {
    return role === 'ADMIN';
}
