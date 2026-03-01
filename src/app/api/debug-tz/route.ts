import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const tz = await prisma.$queryRawUnsafe<any[]>("SHOW timezone");
        const now = await prisma.$queryRawUnsafe<any[]>("SELECT now()::text as now_val, current_timestamp::text as ts");
        return NextResponse.json({
            sessionTimezone: tz[0]?.TimeZone || tz[0]?.timezone,
            dbNow: now[0]?.now_val,
            dbTimestamp: now[0]?.ts,
            serverNow: new Date().toISOString(),
            serverTZ: process.env.TZ || 'not set',
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
