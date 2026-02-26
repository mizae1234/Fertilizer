import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BundleEditClient from './BundleEditClient';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function BundleDetailPage({ params }: Props) {
    const { id } = await params;

    const bundle = await prisma.productBundle.findUnique({
        where: { id },
        include: {
            items: {
                include: {
                    product: {
                        select: { id: true, name: true, code: true, price: true, cost: true, unit: true },
                    },
                },
            },
        },
    });

    if (!bundle || bundle.deletedAt) {
        notFound();
    }

    return <BundleEditClient bundle={JSON.parse(JSON.stringify(bundle))} />;
}
