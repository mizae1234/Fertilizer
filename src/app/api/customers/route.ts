import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanSearchText, parseCustomerSearchTokens } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawSearch = searchParams.get('search') || '';
    const tokens = parseCustomerSearchTokens(rawSearch);

    const tokenConditions = tokens.map(token => {
        const digits = token.replace(/\D/g, '');
        return {
            OR: [
                { name: { contains: token, mode: 'insensitive' as const } },
                { phone: { contains: token, mode: 'insensitive' as const } },
                ...(digits.length >= 3 && digits !== token ? [{ phone: { contains: digits } }] : []),
            ],
        };
    });

    let customers = await prisma.customer.findMany({
        where: {
            deletedAt: null,
            ...(tokenConditions.length > 0 ? { AND: tokenConditions } : {}),
        },
        include: {
            customerGroup: { select: { name: true, id: true } },
        },
        take: 2000,
        orderBy: { name: 'asc' },
    });

    // Fallback: if DB records themselves contain invisible zero-width characters (e.g. saved from LINE copy-paste)
    // or formatted phone numbers with dashes/spaces, normalize in memory so copy-paste ALWAYS matches.
    if (tokens.length > 0 && customers.length === 0) {
        const allCustomers = await prisma.customer.findMany({
            where: { deletedAt: null },
            include: {
                customerGroup: { select: { name: true, id: true } },
            },
            orderBy: { name: 'asc' },
        });
        const lowerTokens = tokens.map(t => t.toLowerCase());
        customers = allCustomers.filter(c => {
            const normName = cleanSearchText(c.name).toLowerCase();
            const normNameNoSpace = normName.replace(/\s+/g, '');
            const normPhone = cleanSearchText(c.phone).toLowerCase();
            const phoneDigits = normPhone.replace(/\D/g, '');
            return lowerTokens.every(tok => {
                const tokDigits = tok.replace(/\D/g, '');
                return (
                    normName.includes(tok) ||
                    normNameNoSpace.includes(tok) ||
                    normPhone.includes(tok) ||
                    (tokDigits.length >= 3 && phoneDigits.includes(tokDigits))
                );
            });
        }).slice(0, 2000);
    }

    return NextResponse.json(customers);
}
