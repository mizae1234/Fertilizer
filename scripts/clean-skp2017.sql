-- ====================================================================
-- Script: Clean Transactions, Products, Customers, Vendors for SKP2017
-- Target DB: skp2017 ONLY
-- ====================================================================

-- 1. Safety verification: Ensure this is executed ONLY on 'skp2017'
DO $$
BEGIN
  IF current_database() != 'skp2017' THEN
    RAISE EXCEPTION 'CRITICAL SAFETY ABORT: Connected to "%", NOT "skp2017"!', current_database();
  END IF;
END $$;

BEGIN;

-- 2. Truncate all transaction tables, products, customers, vendors
TRUNCATE TABLE 
  "SaleEditLog",
  "SaleReturnItem",
  "SaleReturn",
  "DebtInterest",
  "DebtPayment",
  "SaleItem",
  "Sale",
  "GoodsReceiveItem",
  "GoodsReceive",
  "StockTransferItem",
  "StockTransfer",
  "StockWithdrawalItem",
  "StockWithdrawal",
  "FactoryReturnItem",
  "FactoryReturn",
  "QuotationItem",
  "Quotation",
  "Expense",
  "PointTransaction",
  "StockTransaction",
  "ProductLog",
  "ProductBundleItem",
  "ProductBundle",
  "ProductPrice",
  "ProductUnit",
  "ProductStock",
  "Product",
  "Customer",
  "Vendor"
CASCADE;

-- 3. Delete all users except adminskp
DELETE FROM "User" WHERE username != 'adminskp';

-- 4. Assign defaultWarehouseId to main warehouse for adminskp if null
UPDATE "User"
SET "defaultWarehouseId" = (SELECT id FROM "Warehouse" WHERE "isMain" = true LIMIT 1)
WHERE username = 'adminskp' AND ("defaultWarehouseId" IS NULL OR "defaultWarehouseId" = '');

COMMIT;
