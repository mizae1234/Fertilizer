import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const product = await prisma.product.findUnique({
        where: { id: "cmm61ffcz000i01s4jxwcblw2" },
        include: { productUnits: true }
    });
    console.log(JSON.stringify(product, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
