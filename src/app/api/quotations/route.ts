import { NextResponse } from 'next/server';
import { getQuotations } from '@/app/actions/quotations';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';

    const data = await getQuotations(page, search, status);
    return NextResponse.json(data);
}
