// @ts-ignore - Generated after prisma generate
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// @ts-ignore - Prisma 7 driver adapter
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 เริ่มต้น seed data...');

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            name: 'ผู้ดูแลระบบ',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });
    console.log('✅ สร้าง Admin user:', admin.username);

    // Create main warehouse
    await prisma.warehouse.upsert({
        where: { id: 'wh-main' },
        update: {},
        create: { id: 'wh-main', name: 'คลังหลัก', isActive: true },
    });
    console.log('✅ สร้าง คลังหลัก');

    console.log('');
    console.log('🎉 Seed data เสร็จสมบูรณ์!');
    console.log('');
    console.log('📧 Login: admin / admin123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
