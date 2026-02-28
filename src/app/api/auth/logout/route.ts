import { NextResponse } from 'next/server';

export async function POST() {
    const res = NextResponse.json({ ok: true });
    // Clear the token cookie from server side — works on all browsers
    res.cookies.set('token', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
    });
    return res;
}
