export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import DashboardCard from '@/components/DashboardCard';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import { isServerAdmin } from '@/lib/server-auth';

async function getDashboardData() {
    const [
        stockValue,
        lowStockCount,
        todaySales,
        pendingGRs,
        recentGRs,
        recentSales,
    ] = await Promise.all([
        prisma.product.count({
            where: { deletedAt: null, isActive: true },
        }),
        prisma.productStock.count({
            where: {
                quantity: { lt: 10 },
            },
        }),
        prisma.sale.aggregate({
            where: {
                status: 'APPROVED',
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
            _sum: { totalAmount: true },
            _count: true,
        }),
        prisma.goodsReceive.count({
            where: { status: 'PENDING', deletedAt: null },
        }),
        prisma.goodsReceive.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            where: { deletedAt: null },
            include: {
                vendor: { select: { name: true } },
                createdBy: { select: { name: true } },
            },
        }),
        prisma.sale.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            where: { deletedAt: null },
            include: { customer: { select: { name: true } } },
        }),
    ]);

    return {
        totalStock: stockValue,
        lowStockCount,
        todaySalesAmount: todaySales._sum.totalAmount || 0,
        todaySalesCount: todaySales._count || 0,
        pendingGRs,
        recentGRs,
        recentSales,
    };
}

export default async function DashboardPage() {
    const data = await getDashboardData();
    const adminUser = await isServerAdmin();

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">ภาพรวมระบบ</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <DashboardCard
                    title="จำนวนสินค้า"
                    value={data.totalStock.toLocaleString()}
                    icon="📦"
                    color="blue"
                    subtitle="รายการ"
                />
                <DashboardCard
                    title="สินค้าใกล้หมด"
                    value={data.lowStockCount}
                    icon="⚠️"
                    color="orange"
                    subtitle="รายการ"
                />
                {adminUser ? (
                    <DashboardCard
                        title="ยอดขายวันนี้"
                        value={formatCurrency(Number(data.todaySalesAmount))}
                        icon="💰"
                        color="emerald"
                        subtitle={`${data.todaySalesCount} รายการ`}
                    />
                ) : (
                    <DashboardCard
                        title="สร้างบิลวันนี้"
                        value={data.todaySalesCount}
                        icon="🧾"
                        color="emerald"
                        subtitle="รายการ"
                    />
                )}
                <DashboardCard
                    title="รายการรับเข้ารอตรวจสอบ"
                    value={data.pendingGRs}
                    icon="📥"
                    color="purple"
                    subtitle="รายการ"
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Documents */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Recent GRs */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-gray-800">รับสินค้าล่าสุด</h2>
                            <Link href="/goods-receive" className="text-xs text-emerald-600 hover:underline">
                                ดูทั้งหมด
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {data.recentGRs.length === 0 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">ไม่มีรายการ</p>
                            ) : (
                                data.recentGRs.map((gr) => (
                                    <Link
                                        key={gr.id}
                                        href={`/goods-receive/${gr.id}`}
                                        className="flex items-center justify-between gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{gr.grNumber}</p>
                                            <p className="text-xs text-gray-400">
                                                {gr.vendor.name} · {gr.createdBy.name} · {new Date(gr.createdAt).toLocaleDateString('th-TH')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-gray-800">
                                                {formatCurrency(Number(gr.totalAmount))}
                                            </p>
                                            <StatusBadge status={gr.status} />
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Recent Sales */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-gray-800">รายการขายล่าสุด</h2>
                            <Link href="/sales" className="text-xs text-emerald-600 hover:underline">
                                ดูทั้งหมด
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {data.recentSales.length === 0 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">ไม่มีรายการ</p>
                            ) : (
                                data.recentSales.map((sale) => (
                                    <Link
                                        key={sale.id}
                                        href={`/sales/${sale.id}`}
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">
                                                {sale.saleNumber}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {sale.customer?.name || 'ลูกค้าทั่วไป'} · {new Date(sale.createdAt).toLocaleDateString('th-TH')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-gray-800">
                                                {formatCurrency(Number(sale.totalAmount))}
                                            </p>
                                            <StatusBadge status={sale.status} />
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
                        <h3 className="font-semibold text-lg mb-2">สร้างรายการใหม่</h3>
                        <p className="text-emerald-100 text-sm mb-5">บันทึกการรับเข้าหรือขายสินค้า</p>
                        <div className="space-y-3">
                            <Link
                                href="/pos"
                                className="block w-full py-2.5 rounded-xl bg-white text-emerald-600 text-center font-medium text-sm hover:bg-emerald-50 transition-colors"
                            >
                                🛒 เปิด POS ขายสินค้า
                            </Link>
                            <Link
                                href="/goods-receive/new"
                                className="block w-full py-2.5 rounded-xl bg-white/20 text-white text-center font-medium text-sm hover:bg-white/30 transition-colors"
                            >
                                📥 นำเข้าสินค้า
                            </Link>
                            <Link
                                href="/transfers/new"
                                className="block w-full py-2.5 rounded-xl bg-white/20 text-white text-center font-medium text-sm hover:bg-white/30 transition-colors"
                            >
                                🔄 โอนย้ายสินค้า
                            </Link>
                        </div>
                    </div>

                    {/* Pending Actions */}
                    {data.pendingGRs > 0 && (
                        <div className="bg-white rounded-xl shadow-md border border-orange-100 p-5">
                            <div className="flex items-center gap-3 text-orange-600 mb-2">
                                <span className="text-xl">⏳</span>
                                <h3 className="font-semibold">รอการดำเนินการ</h3>
                            </div>
                            <p className="text-sm text-gray-500 mb-3">
                                คุณมี {data.pendingGRs} รายการรับสินค้ารอตรวจสอบ
                            </p>
                            <Link
                                href="/goods-receive?status=PENDING"
                                className="text-sm text-emerald-600 font-medium hover:underline"
                            >
                                ไปที่หน้ารับสินค้า →
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
