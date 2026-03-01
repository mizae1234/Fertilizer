import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signToken } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user || user.deletedAt) {
            return NextResponse.json(
                { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
                { status: 401 }
            );
        }

        const isValid = await comparePassword(password, user.password);

        if (!isValid) {
            return NextResponse.json(
                { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
                { status: 401 }
            );
        }

        const allowedMenus = user.allowedMenus as string[] | null;

        const token = signToken({
            userId: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            allowedMenus,
            defaultWarehouseId: user.defaultWarehouseId,
            printSetting: user.printSetting || 'bill',
        });

        return NextResponse.json({
            token,
            user: { id: user.id, name: user.name, role: user.role },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาด' },
            { status: 500 }
        );
    }
}
