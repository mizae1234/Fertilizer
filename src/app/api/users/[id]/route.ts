import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        // Return safe fields (exclude password)
        return NextResponse.json({
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            allowedMenus: user.allowedMenus,
            defaultWarehouseId: user.defaultWarehouseId,
            printSetting: user.printSetting || 'bill',
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ error: 'Failed to fetch user: ' + (error as Error).message }, { status: 500 });
    }
}
