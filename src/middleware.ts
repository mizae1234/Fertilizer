import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value;
    const { pathname } = request.nextUrl;

    // Login page: redirect to home if already logged in
    if (pathname === '/login') {
        if (token) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    }

    // All other matched routes: require auth
    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api routes (/api/*)
         * - static files (_next/static, _next/image, favicon.ico, etc.)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
