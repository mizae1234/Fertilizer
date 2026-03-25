-- สคริปต์สำหรับลบข้อมูล Transaction และสินค้าทั้งหมด (เก็บเฉพาะ User, Customer, Master Data บางส่วน)
-- หมายเหตุ: รันทีละ statement ตามลำดับเพื่อป้องกันปัญหา Foreign Key (ลบลูกก่อนลบแม่)

-- ==========================================
-- 1. ลบข้อมูลฝั่งขาย (Sales & Returns & Debts)
-- ==========================================
DELETE FROM "SaleReturnItem";
DELETE FROM "SaleReturn";
DELETE FROM "SaleEditLog";
DELETE FROM "DebtPayment";
DELETE FROM "DebtInterest";
DELETE FROM "SaleItem";
DELETE FROM "Sale";

-- ==========================================
-- 2. ลบข้อมูลฝั่งรับเข้า (Goods Receive)
-- ==========================================
DELETE FROM "GoodsReceiveItem";
DELETE FROM "GoodsReceive";

-- ==========================================
-- 3. ลบข้อมูลฝั่งโอนย้าย (Stock Transfer)
-- ==========================================
DELETE FROM "StockTransferItem";
DELETE FROM "StockTransfer";

-- ==========================================
-- 4. ลบข้อมูลฝั่งเคลมโรงงาน (Factory Return)
-- ==========================================
DELETE FROM "FactoryReturnItem";
DELETE FROM "FactoryReturn";

-- ==========================================
-- 5. ลบข้อมูลใบเสนอราคา (Quotations)
-- ==========================================
DELETE FROM "QuotationItem";
DELETE FROM "Quotation";

-- ==========================================
-- 6. ลบข้อมูลปรับปรุงสต็อก (Stock Adjustments & Movements)
-- ==========================================
DELETE FROM "StockTransaction";
DELETE FROM "ProductStock";

-- ==========================================
-- 7. ลบข้อมูลแต้มลูกค้าและรายจ่าย
-- ==========================================
DELETE FROM "PointTransaction";
UPDATE "Customer" SET "totalPoints" = 0;
DELETE FROM "Expense";

-- ==========================================
-- 8. ลบข้อมูลสินค้า (Product-related)
-- ==========================================
DELETE FROM "ProductLog";
DELETE FROM "ProductBundleItem";
DELETE FROM "ProductBundle";
DELETE FROM "ProductPrice";
DELETE FROM "ProductUnit";
DELETE FROM "Product";
DELETE FROM "ProductGroup";

-- ==========================================
-- รายการข้อมูลที่จะยังคงเหลืออยู่ (ไม่ถูกลบ):
-- 1. User (ผู้ใช้งานระบบ)
-- 2. Customer & CustomerGroup (ลูกค้าและกลุ่มลูกค้า)
-- 3. Vendor (ผู้ส่งสินค้า/โรงงาน)
-- 4. Warehouse (คลังสินค้า)
-- 5. BankAccount (บัญชีธนาคาร)
-- 6. ReceiptTemplate (รูปแบบใบเสร็จ)
-- 7. ShopInfo (ข้อมูลร้าน)
-- ==========================================
