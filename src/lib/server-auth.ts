import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function getServerUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    return verifyToken(token);
}

export async function isServerAdmin(): Promise<boolean> {
    const user = await getServerUser();
    return user?.role === 'ADMIN';
}
