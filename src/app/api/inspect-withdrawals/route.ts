import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const wds = await prisma.stockWithdrawal.findMany({
      where: {
        withdrawalNumber: { in: ['WD-2026-00000049', 'WD-2026-00000048'] },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, cost: true } },
          },
        },
      },
    });
    return NextResponse.json({ success: true, wds });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
