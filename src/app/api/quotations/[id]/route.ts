import { NextResponse } from 'next/server';
import { getQuotationDetail } from '@/app/actions/quotations';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const quotation = await getQuotationDetail(id);
    if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(quotation);
}
