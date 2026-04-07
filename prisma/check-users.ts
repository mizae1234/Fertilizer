import pg from 'pg';
import 'dotenv/config';

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const res = await pool.query('SELECT username, name, role FROM "User" WHERE "deletedAt" IS NULL');
    console.log('Users in DB:');
    console.table(res.rows);
    await pool.end();
}

main().catch(console.error);
