---
name: Fertilizer POS Codebase Reference
description: Complete code structure, functions, and architecture reference for the Fertilizer POS system
---

# Fertilizer POS — Complete Codebase Reference

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- **Styling**: Tailwind CSS
- **Auth**: JWT (cookie-based, `jsonwebtoken` + `bcryptjs`)
- **Deployment**: Docker + Caddy reverse proxy

---

## Project Structure

```
src/
├── app/
│   ├── (main)/          # Protected pages (layout w/ Sidebar)
│   ├── (print)/         # Print-only layouts (receipt, invoice, quotation)
│   ├── actions/         # Server Actions (business logic)
│   ├── api/             # API Routes (REST endpoints)
│   ├── login/           # Login page
│   ├── layout.tsx       # Root layout
│   └── globals.css      # Global styles
├── components/          # 17 reusable UI components
├── generated/prisma/    # Prisma generated client
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
├── types/               # TypeScript type definitions
└── middleware.ts         # Auth middleware
prisma/
├── schema.prisma        # Database schema (28 models)
├── seed.ts              # Dev seed
├── seed-production.ts   # Production seed
├── seed-demo.ts         # Demo site seed
├── backfill-conversion-rate.ts
└── backfill-sale-cost.ts
deploy.sh                # Single site deploy
deploy-all.sh            # Production multi-site deploy
deploy-demo.sh           # Demo site deploy
setup.sh                 # Initial server setup
```

---

## Database Schema (28 Models)

### Enums
| Enum | Values |
|------|--------|
| `UserRole` | `ADMIN`, `STAFF` |
| `OrderStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `TransactionType` | `GOODS_RECEIVE`, `SALE`, `SALE_CANCEL`, `SALE_RETURN`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`, `FACTORY_RETURN`, `WITHDRAWAL` |

### Core Models

| Model | Key Fields | Description |
|-------|-----------|-------------|
| `User` | username, password, name, role, allowedMenus, defaultWarehouseId, printSetting | ผู้ใช้งาน (ADMIN/STAFF), menu permission (JSON array), print bill/invoice/none |
| `Warehouse` | name, location, isActive, isMain | คลังสินค้า, supports multi-warehouse |
| `ReceiptTemplate` | warehouseId, paperSize(58mm/80mm/A4), showLogo, headerText, footerText, showVat, showQr | Template ใบเสร็จ per warehouse |
| `ShopInfo` | name, taxId, address, notes, logoUrl | ข้อมูลร้าน (Singleton id="shop-info") |
| `BankAccount` | accountName, accountNumber, bankName, qrCodeUrl, isDefault | บัญชีธนาคาร |

### Product Models

| Model | Description |
|-------|-------------|
| `ProductGroup` | หมวดหมู่สินค้า (name unique) |
| `Product` | สินค้า: code(unique), name, unit, cost, costMethod(AVG/LAST/MANUAL), price, brand, packaging, pointsPerUnit, minStock, imageUrl |
| `ProductStock` | Stock per product+warehouse (quantity, avgCost, lastCost), @@unique([productId, warehouseId]) |
| `ProductPrice` | ราคาตามกลุ่มลูกค้า, @@unique([productId, customerGroupId, productUnitId]) |
| `ProductUnit` | หน่วยขาย (unitName, conversionRate, sellingPrice, isBaseUnit) |
| `ProductLog` | Audit log: action(CREATE/UPDATE/DELETE/PRICE_CHANGE/COST_UPDATE), field, oldValue, newValue |
| `ProductBundle` | ชุดสินค้า: code(unique), bundlePrice, bundleCost |
| `ProductBundleItem` | Items in bundle: productId, quantity |

### Customer Models

| Model | Description |
|-------|-------------|
| `CustomerGroup` | กลุ่มลูกค้า (name unique), linked to ProductPrice |
| `Customer` | ลูกค้า: name, phone, customerGroupId, address, taxId, totalPoints |
| `PointTransaction` | แต้มสะสม: type(EARN/REDEEM), points, reference |

### Vendor & GR Models

| Model | Description |
|-------|-------------|
| `Vendor` | ผู้ส่งสินค้า: name, phone, lineId, address |
| `GoodsReceive` | ใบรับสินค้า: grNumber, vendorId, status, totalAmount, goodsPaid, shippingPaid, shippingCost |
| `GoodsReceiveItem` | รายการ: productId, warehouseId, quantity, unitCost, lotNo |

### Sales Models

| Model | Description |
|-------|-------------|
| `Sale` | บิลขาย: saleNumber, customerId, status, totalAmount, paymentMethod(CASH/CREDIT_CARD/CREDIT/SPLIT/PAID), payments(JSON), discount, cashReceived |
| `SaleItem` | รายการขาย: productId, warehouseId, quantity, unitPrice, unitCost, discount, points, unitName, conversionRate |
| `SaleReturn` | คืนสินค้า: returnNumber, saleId, reason, totalAmount |
| `SaleReturnItem` | รายการคืน: saleItemId, productId, warehouseId, quantity, unitPrice |
| `SaleEditLog` | ประวัติแก้ไขบิล: action(UPDATE/CANCEL/RETURN), changes(JSON) |

### Debt Models

| Model | Description |
|-------|-------------|
| `DebtPayment` | ชำระหนี้: saleId, amount, method, dueDate |
| `DebtInterest` | ดอกเบี้ย: saleId, percentage, baseAmount, amount |

### Transfer, Adjustment & Withdrawal Models

| Model | Description |
|-------|-------------|
| `StockTransfer` | โอนย้ายสินค้า: transferNumber, fromWarehouseId, toWarehouseId, status |
| `StockTransferItem` | รายการโอน: productId, warehouseId, quantity |
| `StockTransaction` | ทุก stock movement: productId, warehouseId, type(TransactionType), quantity(positive/negative), unitCost, reference, lotNo |
| `StockWithdrawal` | เบิกสินค้า: withdrawalNumber, requesterName, approverName, notes, status |
| `StockWithdrawalItem` | รายการเบิก: productId, warehouseId, quantity, unitCost |

### Factory Return & Quotation Models

| Model | Description |
|-------|-------------|
| `FactoryReturn` | เคลมคืนโรงงาน: returnNumber, vendorId, status, senderName, receiverName |
| `FactoryReturnItem` | รายการเคลม: productId, warehouseId, quantity, unitCost |
| `Quotation` | ใบเสนอราคา: quotationNumber, customerId, customerName, validUntil, status(DRAFT/SENT/ACCEPTED/EXPIRED) |
| `QuotationItem` | รายการเสนอราคา: productId, quantity, unitPrice, unitName |

### Other Models

| Model | Description |
|-------|-------------|
| `Expense` | บันทึกรายจ่าย: expenseNumber, category, amount, description, reference, expenseDate |

---

## Server Actions (`src/app/actions/`)

### sales.ts — จัดการบิลขาย
| Function | Params | Description |
|----------|--------|-------------|
| `getSales(page, status)` | page=1, status='' | List sales with pagination, include customer & createdBy |
| `getSaleDetail(id)` | sale id | Get full sale detail with items, returns, edit logs |
| `approveSale(id)` | sale id | Validate stock → deduct stock → create StockTransaction(SALE) → award customer points (in $transaction) |
| `rejectSale(id)` | sale id | Set status=REJECTED |
| `updateSale(id, data)` | id, {customerId, notes, billDiscount, userId, items[]} | Reverse old stock if APPROVED → delete old items → create new items with product.cost → recalculate payments JSON → create SaleEditLog (in $transaction) |
| `cancelSale(id, userId?)` | sale id | Restore stock from original StockTransaction quantities → create SALE_CANCEL transactions → set CANCELLED → create audit log (in $transaction) |

### pos.ts — POS ขายสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `createSaleFromPOS(data)` | {customerId, items[], userId, payments[], notes, discount, cashReceived} | Validate payments sum → create Sale(APPROVED) with product.cost → deduct stock (qty × conversionRate) → create StockTransaction(SALE) → award points. Retry on saleNumber collision (3 attempts) |

### products.ts — จัดการสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getProducts(page, search)` | page=1, search='' | List with productGroup, stocks, prices |
| `createProduct(data)` | {code?, name, unit, cost, price, brand, packaging, productGroupId, pointsPerUnit, minStock, imageUrl, prices[], units[]} | Auto-generate 5-digit code if empty, create with prices & units |
| `updateProduct(id, data)` | id, {name, unit, cost, price, brand, productGroupId, pointsPerUnit, minStock, prices[]} | Update product + replace all ProductPrice records |
| `deleteProduct(id)` | product id | Check for existing transactions → soft delete (set deletedAt) |
| `updateProductCost(productId, costType, customCost?)` | productId, 'avg'\|'last'\|'custom' | Recalculate cost: AVG=weighted average from GOODS_RECEIVE, LAST=latest GR unitCost, custom=manual |

### goods-receive.ts — ใบรับสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getGoodsReceives(page, status)` | page=1, status='' | List GR with vendor & createdBy |
| `getGoodsReceiveDetail(id)` | GR id | Full detail with items, product costMethod |
| `createGoodsReceive(data)` | {vendorId, poNumber, notes, receivedDate, items[], userId} | Create GR(PENDING) with generateNumber('GR') |
| `updateGoodsReceive(id, data)` | id, {vendorId, poNumber, notes, receivedDate, items[]} | Only PENDING, delete old items → create new |
| `approveGoodsReceive(id, costMethodOverrides?)` | GR id, {productId: method} | **Complex**: Update stock (avg cost calc) → create StockTransaction(GOODS_RECEIVE) → update product.cost based on costMethod (AVG=moving weighted average, LAST=latest, MANUAL=GR unitCost) → create ProductLog |
| `rejectGoodsReceive(id)` | GR id | Set status=REJECTED |
| `deleteGoodsReceive(id)` | GR id | Only non-APPROVED, soft delete |
| `updateGoodsReceivePayment(id, data)` | id, {goodsPaid, shippingPaid, shippingCost} | Update payment tracking on GR |

### expenses.ts — บันทึกรายจ่าย
| Function | Params | Description |
|----------|--------|-------------|
| `getExpenses(page, search, category, dateFrom, dateTo)` | page=1 | List with date range filter, aggregate sum |
| `createExpense(data)` | {category, amount, description, reference, expenseDate} | Auth from cookie, generateNumber('EXP') |
| `updateExpense(id, data)` | id, same fields | Update expense |
| `deleteExpense(id)` | expense id | Soft delete |

### transfers.ts — โอนย้ายสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getTransfers(page, status)` | page=1, status='' | List with warehouse names |
| `getTransferDetail(id)` | transfer id | Full detail with items |
| `createTransfer(data)` | {fromWarehouseId, toWarehouseId, notes, items[]} | Auth from cookie, create PENDING |
| `approveTransfer(id)` | transfer id | Deduct from source → add to dest → create TRANSFER_OUT + TRANSFER_IN transactions |
| `rejectTransfer(id)` | transfer id | Set REJECTED |

### factory-returns.ts — เคลมคืนโรงงาน
| Function | Params | Description |
|----------|--------|-------------|
| `createFactoryReturn(data)` | {vendorId, items[], senderName, receiverName, notes, userId} | Create APPROVED → deduct stock → create StockTransaction(FACTORY_RETURN) |
| `getFactoryReturns(page, from, to)` | page=1 | List with date filter |
| `cancelFactoryReturn(id)` | FR id | Restore stock → create cancellation transactions → set CANCELLED |

### debt.ts — จัดการหนี้
| Function | Params | Description |
|----------|--------|-------------|
| `getDebtDetail(saleId)` | sale id | Full debt calculation: totalBill + totalInterest - initialPaid - debtPaid = remaining |
| `addInterest(saleId, percentage, note?)` | sale id, % | Calculate interest on remaining balance |
| `payDebt(saleId, payments[])` | sale id, [{method, amount, dueDate}] | Transaction-safe payment, update dueDate if CREDIT, set paymentMethod='PAID' if fully paid |

### sale-returns.ts — คืนสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `createSaleReturn(data)` | {saleId, reason, userId, items[]} | Validate APPROVED + max returnable qty → restore stock → create StockTransaction(SALE_RETURN) → deduct sale totalAmount/totalPoints → create audit log. Retry on collision |
| `getSaleReturns(saleId)` | sale id | List returns for a sale |

### quotations.ts — ใบเสนอราคา
| Function | Params | Description |
|----------|--------|-------------|
| `getQuotations(page, search, status)` | page=1 | List with search on number/customerName |
| `getQuotationDetail(id)` | quotation id | Full detail with items |
| `createQuotation(data)` | {customerId, customerName, validUntil, notes, discount, userId, items[]} | Create DRAFT, retry on collision |
| `updateQuotation(id, data)` | id, {customerId, customerName, validUntil, notes, discount, status, items[]} | Update header + replace items |
| `deleteQuotation(id)` | id | Only DRAFT can delete (hard delete) |

### bundles.ts — ชุดสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getBundles(page, search)` | page=1 | List with items and product details |
| `getBundleDetail(id)` | bundle id | Single bundle with items |
| `createBundle(data)` | {name, description, bundlePrice, bundleCost, items[]} | Auto-gen code 'BD0001', retry on collision |
| `updateBundle(id, data)` | id, same | Update header + replace items |
| `deleteBundle(id)` | id | Soft delete |
| `getActiveBundles()` | — | All active bundles for POS |

### stock-adjustments.ts — ปรับปรุง Stock
| Function | Params | Description |
|----------|--------|-------------|
| `getStockAdjustments(page, search, from, to)` | page=1 | List ADJUSTMENT type transactions |
| `createStockAdjustment(data)` | {adjustmentType(increase/decrease), note, items[], userId} | Adjust stock + create StockTransaction(ADJUSTMENT) |

### stock-withdrawals.ts — เบิกสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getStockWithdrawals(page, search, from, to)` | page=1 | List withdrawals with date filtering |
| `createStockWithdrawal(data)` | {requesterName, approverName, note, items[], userId} | Deduct stock + create StockTransaction(WITHDRAWAL) |

### customers.ts — ลูกค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getCustomers(page, search)` | page=1 | List with customerGroup |
| `createCustomer(data)` | {name, phone, customerGroupId, address, taxId} | Create customer |
| `updateCustomer(id, data)` | id, same | Update |
| `deleteCustomer(id)` | id | Check transactions → soft delete |
| `redeemPoints(customerId, points, description)` | — | Validate points → create REDEEM PointTransaction → decrement totalPoints |
| `getCustomerDetail(id)` | id | With group, points history (20), sales history (10) |

### customer-groups.ts — กลุ่มลูกค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getCustomerGroups()` | — | All groups with counts |
| `createCustomerGroup(name)` | name | Create unique name |
| `updateCustomerGroup(id, name)` | id, name | Update unique name |
| `deleteCustomerGroup(id)` | id | Check customers exist → delete prices → hard delete |

### users.ts — ผู้ใช้
| Function | Params | Description |
|----------|--------|-------------|
| `getUsers()` | — | All active users |
| `getUserById(id)` | id | Single user with permissions |
| `createUser(data)` | {username, password, name, role, allowedMenus, printSetting} | Check unique username → hash password → create |
| `updateUser(id, data)` | id, {username, password, name, role, allowedMenus, defaultWarehouseId, printSetting} | Conditional update |
| `deleteUser(id)` | id | Protect 'admin' user → soft delete |

### vendors.ts — ผู้ส่งสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getVendors(search)` | search='' | All active vendors |
| `createVendor(data)` | {name, phone, lineId, address} | Create |
| `updateVendor(id, data)` | id, same + isActive | Update |
| `deleteVendor(id)` | id | Soft delete |

### warehouses.ts — คลังสินค้า
| Function | Params | Description |
|----------|--------|-------------|
| `getWarehouses()` | — | All active with product stock counts |
| `createWarehouse(data)` | {name, location} | Create |
| `updateWarehouse(id, data)` | id, {name, location, isActive} | Update |
| `deleteWarehouse(id)` | id | Soft delete |
| `setMainWarehouse(id)` | id | Unset all isMain → set this one |

### reports/ — รายงาน

#### sales-reports.ts
| Function | Description |
|----------|-------------|
| `getSalesOverview(dateFrom?, dateTo?)` | สรุปยอดขาย: total sales, revenue, cost, profit, by payment method |
| `getSalesDetail(dateFrom?, dateTo?)` | รายละเอียดยอดขาย per bill with items |
| `getTopProducts(dateFrom?, dateTo?)` | สินค้าขายดี: ranked by quantity & revenue |
| `getCustomerReport(dateFrom?, dateTo?)` | รายงานลูกค้า: purchase summary per customer |

#### stock-reports.ts
| Function | Description |
|----------|-------------|
| `getStockDetailReport(dateFrom?, dateTo?)` | เคลื่อนไหว Stock: all transactions with product/warehouse |
| `getInventoryReport()` | สรุป Stock คงเหลือ: current inventory across warehouses |

#### financial-reports.ts
| Function | Description |
|----------|-------------|
| `getCashFlowReport(dateFrom?, dateTo?)` | กระแสเงินสด: income vs expenses breakdown |
| `getPnLReport(dateFrom?, dateTo?)` | กำไร-ขาดทุนรวม (per bill): revenue - cost - expenses |
| `getPnLDetail(dateFrom?, dateTo?)` | กำไร-ขาดทุนรายสินค้า: per item profit |

---

## API Routes (`src/app/api/`)

37 API route files organized by resource:

| Route Group | Endpoints | Purpose |
|-------------|-----------|---------|
| `auth/login` | POST | Login: verify password → sign JWT → set cookie |
| `auth/logout` | POST | Clear token cookie |
| `products/` | GET (list), POST (create) | Products CRUD |
| `products/[id]` | GET, PUT, DELETE | Single product |
| `products/[id]/units` | GET, POST | ProductUnit management |
| `products/[id]/units/[unitId]` | PUT, DELETE | Single unit |
| `products/[id]/prices` | GET, PUT | ProductPrice per customer group |
| `products/[id]/history` | GET | ProductLog history |
| `products/export` | GET | Export products to Excel |
| `products/import` | POST | Import products from Excel (multi-warehouse) |
| `products/import-template` | GET | Download import Excel template |
| `products/brands` | GET | Distinct brand list |
| `products/packagings` | GET | Distinct packaging list |
| `products/unit-names` | GET | Distinct unit names |
| `sales/[id]` | GET | Sale detail |
| `customers/` | GET | Customer list |
| `customers/[id]` | GET | Customer detail |
| `customer-groups/` | GET | Customer group list |
| `bundles/` | GET | Bundle list |
| `bank-accounts/` | GET, POST | Bank accounts |
| `bank-accounts/[id]` | PUT, DELETE | Single bank account |
| `goods-receive/[id]` | GET | GR detail |
| `factory-returns/[id]` | GET | FR detail |
| `transfers/[id]` | GET | Transfer detail |
| `quotations/` | GET | Quotation list |
| `quotations/[id]` | GET | Quotation detail |
| `users/` | GET | User list |
| `users/[id]` | GET, PUT | Single user |
| `vendors/` | GET | Vendor list |
| `warehouses/` | GET | Warehouse list |
| `product-groups/` | GET, POST, PUT, DELETE | ProductGroup CRUD |
| `receipt-template/` | GET, POST | Receipt template |
| `shop-info/` | GET, PUT | Shop info singleton |
| `owner-dashboard/` | GET | Owner dashboard aggregate data |
| `upload/` | POST | File upload |
| `uploads/[filename]` | GET | Serve uploaded files |

---

## Lib Utilities (`src/lib/`)

### auth.ts
| Function | Description |
|----------|-------------|
| `signToken(payload: JWTPayload)` | Sign JWT with 7d expiry |
| `verifyToken(token)` | Verify & decode JWT, return null if invalid |
| `hashPassword(password)` | bcrypt hash (salt rounds=10) |
| `comparePassword(password, hash)` | bcrypt compare |

**JWTPayload**: `{ userId, username, name, role, allowedMenus, defaultWarehouseId, printSetting }`

### prisma.ts
- Creates PrismaClient with `@prisma/adapter-pg` (pg Pool)
- Sets timezone `Asia/Bangkok` on connection
- Global singleton pattern for dev hot reload

### generateNumber.ts
| Function | Description |
|----------|-------------|
| `generateNumber(prefix)` | Generate `PREFIX-YYYY-XXXXXXXX` format (e.g. `SL-2026-00000001`) |

Prefix mapping: SL→Sale, QT→Quotation, EXP→Expense, TF→StockTransfer, ADJ→StockTransaction(reference), GR→GoodsReceive, FR→FactoryReturn, RT→SaleReturn, WD→StockWithdrawal

### utils.ts
| Function | Description |
|----------|-------------|
| `formatCurrency(amount)` | Format as THB (฿), no decimals |
| `formatNumber(num)` | Thai number format with commas |
| `formatDate(date)` | Thai date: `25 มี.ค. 2026`, timezone `Asia/Bangkok` |
| `formatDateTime(date)` | Thai date + time: `25 มี.ค. 2026 15:30` |
| `cn(...classes)` | Classname joiner (filter falsy) |

### constants.ts
| Constant | Values |
|----------|--------|
| `PAYMENT_METHODS` | CASH(💵เงินสด), TRANSFER(🏦เงินโอน), CREDIT(📋เครดิต) |
| `EXPENSE_CATEGORIES` | ค่าขนส่ง, ค่าน้ำมัน, ค่าเช่า, ค่าแรง, ค่าสาธารณูปโภค, ค่าซ่อมแซม, อื่นๆ |
| `ORDER_STATUS_MAP` | PENDING(⏳รออนุมัติ), APPROVED(✅อนุมัติแล้ว), REJECTED(❌ปฏิเสธ), CANCELLED(🚫ยกเลิก) |
| `ADJUSTMENT_REASONS` | สินค้าเสียหาย, หมดอายุ, สูญหาย, นับสต็อกจริง(เพิ่ม/ลด), อื่นๆ |

### server-auth.ts
| Function | Description |
|----------|-------------|
| `getServerUser()` | Get user from cookie in Server Components |
| `isServerAdmin()` | Check if current user is ADMIN |

### menus.ts
- `MENU_GROUPS[]` — 4 groups: หลัก, จัดการข้อมูล, เอกสาร, รายงาน
- `ALL_MENU_HREFS` — Flat array of all menu paths for permission assignment

---

## Hooks (`src/hooks/`)

### useUser.ts (Client-side)
| Function | Description |
|----------|-------------|
| `useUser()` | Parse JWT from cookie → return `{ userId, username, name, role, allowedMenus, defaultWarehouseId }` |
| `isAdmin(role?)` | Check if role === 'ADMIN' |

---

## Types (`src/types/index.ts`)

| Type | Description |
|------|-------------|
| `ApiResponse<T>` | `{ data: T, error?: string }` |
| `PaginatedResponse<T>` | `{ data: T[], total, page, pageSize, totalPages }` |
| `SelectOption` | `{ value, label, disabled? }` |
| `ProductWithStock` | Product + group + stocks(warehouse) + units + prices(customerGroup) |
| `ProductBasic` | Product + group |
| `CustomerWithGroup` | Customer + customerGroup |
| `SaleWithDetails` | Sale + customer + createdBy + items(product, warehouse) + debtPayments + debtInterests |
| `GoodsReceiveWithDetails` | GR + vendor + createdBy + items(product, warehouse) |
| `TransferWithDetails` | Transfer + createdBy + warehouses + items(product, warehouse) |
| `FactoryReturnWithDetails` | FR + vendor + createdBy + items(product, warehouse) |

---

## Components (`src/components/`)

| Component | Props | Description |
|-----------|-------|-------------|
| `Sidebar` | — | ด้านข้าง: logo, menu groups from menus.ts, active state, responsive (collapsible mobile), role-based menu filtering |
| `DataTable` | columns, data, actions? | ตารางข้อมูล: generic with sorting, responsive |
| `Pagination` | currentPage, totalPages, onChange | แบ่งหน้า with prev/next and page numbers |
| `SearchBar` | value, onChange, placeholder? | ค้นหา with debounce |
| `DateRangeFilter` | dateFrom, dateTo, onChange | ช่วงวันที่ filter |
| `PageHeader` | title, subtitle?, action? | หัวหน้า with breadcrumb-style |
| `DashboardCard` | title, value, icon, color? | การ์ด dashboard stat |
| `FormInput` | label, name, type, required?, error? | Input field with label |
| `FormSelect` | label, name, options[], required? | Select dropdown with label |
| `FormTextarea` | label, name, required? | Textarea with label |
| `StatusBadge` | status | แสดงสถานะ color badge using ORDER_STATUS_MAP |
| `SortableHeader` | label, sortKey, currentSort, onSort | หัวตาราง sortable |
| `LoadingSpinner` | — | Loading spinner |
| `EmptyState` | message?, icon? | Empty data state |
| `DeleteButton` | onDelete, label? | ลบ with confirmation |
| `ConfirmModal` | open, onConfirm, onCancel, title, message | Confirm dialog |
| `AlertModal` | open, onClose, title, message, type? | Alert dialog (success/error/warning) |

---

## Pages (`src/app/(main)/`)

| Path | Module | Description |
|------|--------|-------------|
| `/` | Dashboard | Main dashboard with sales/stock/expense stats |
| `/pos` | POS | Point of Sale: product search, cart, payment (multi-method), checkout |
| `/sales` | Sales List | ตารางบิลขาย with status filter, search, date filter |
| `/sales/[id]` | Sale Detail | รายละเอียดบิล, approve/reject/cancel, edit, return |
| `/overdue-bills` | Overdue Bills | บิลค้างจ่าย list (CREDIT payment) |
| `/overdue-bills/[id]` | Debt Detail | ชำระหนี้, add interest |
| `/products` | Products | รายการสินค้า with search, pagination, export |
| `/products/new` | New Product | สร้างสินค้าใหม่ |
| `/products/[id]` | Product Detail | แก้ไข/ลบ product, stock view, price tiers, units, cost management |
| `/bundles` | Bundles | ชุดสินค้า list |
| `/bundles/new` | New Bundle | สร้างชุดสินค้า |
| `/warehouses` | Warehouses | คลังสินค้า CRUD |
| `/vendors` | Vendors | ผู้ส่งสินค้า CRUD |
| `/customers` | Customers | ลูกค้า list with search |
| `/customers/[id]` | Customer Detail | รายละเอียดลูกค้า, points history, redeem points |
| `/customer-groups` | Customer Groups | กลุ่มลูกค้า CRUD |
| `/goods-receive` | Goods Receive | ใบรับสินค้า list with filtering (search, status, date) |
| `/goods-receive/[id]` | GR Detail | รายละเอียด GR, approve with cost method, payment tracking |
| `/transfers` | Transfers | โอนย้ายสินค้า list |
| `/transfers/new` | New Transfer | สร้างใบโอน |
| `/stock-adjustments` | Stock Adjustments | ปรับปรุง Stock list + create |
| `/stock-withdrawals` | Stock Withdrawals | เบิกสินค้า list |
| `/stock-withdrawals/new` | New Withdrawal | สร้างใบเบิกสินค้า |
| `/factory-returns` | Factory Returns | เคลมคืนโรงงาน list |
| `/factory-returns/new` | New FR | สร้างเคลมคืน |
| `/quotations` | Quotations | ใบเสนอราคา list |
| `/quotations/new` | New Quotation | สร้างใบเสนอราคา |
| `/expenses` | Expenses | บันทึกรายจ่าย with category/date filter |
| `/bank-accounts` | Bank Accounts | บัญชีธนาคาร CRUD |
| `/settings/receipt-template` | Receipt Template | ตั้งค่า template ใบเสร็จ |
| `/settings/shop-info` | Shop Info | ข้อมูลร้าน |
| `/settings/product-groups` | Product Groups | หมวดหมู่สินค้า CRUD |
| `/reports` | Reports | รายงาน: sales overview, top products, stock, PnL, cash flow |
| `/owner-dashboard` | Owner Dashboard | สรุปภาพรวม dashboard for owner |
| `/users` | Users | จัดการผู้ใช้ CRUD (ADMIN only) |

## Print Pages (`src/app/(print)/`)

| Path | Description |
|------|-------------|
| `/receipt/[id]` | พิมพ์ใบเสร็จ (58mm/80mm/A4 based on template) |
| `/invoice/[id]` | พิมพ์ใบแจ้งหนี้/ใบวางบิล A4 |
| `/quotation-print/[id]` | พิมพ์ใบเสนอราคา A4 |

---

## Middleware (`src/middleware.ts`)
- Redirects unauthenticated users to `/login` (except `/api/*`, `/_next/*`)
- Redirects authenticated users from `/login` to `/`

---

## Key Patterns & Conventions

1. **Soft Delete**: Most models use `deletedAt` field, filter with `deletedAt: null`
2. **Number Generation**: `generateNumber(prefix)` → `PREFIX-YYYY-XXXXXXXX` with collision retry
3. **Stock Flow**: All stock changes recorded in `StockTransaction` with appropriate `TransactionType`. *UI Note: When rendering stock history (+/-), always rely on `quantity > 0` vs `quantity < 0` instead of hardcoding transaction types to ensure accuracy across complex mappings (e.g. Withdrawals, Factory Returns).*
4. **Cost Calculation**: Product cost tracked via `costMethod` (AVG/LAST/MANUAL), auto-updated on GR approval
5. **Auth**: JWT cookie-based, parsed client-side via `useUser()`, server-side via `getServerUser()`
6. **Pagination**: Standard pattern with `page`, `perPage=10`, returns `{ data, totalPages }`
7. **Transactions**: Critical operations use `prisma.$transaction()` for atomicity
8. **Path Revalidation**: `revalidatePath()` called after mutations for ISR
9. **Thai Locale**: All UI text, date formatting, and currency in Thai (฿, th-TH)
10. **Import/Export**: Excel import/export for products with multi-warehouse support

---

## Technical Notes & Known Operations

### 🔄 Resetting Transactions & Products (Fresh Start)
When a site needs to be reset (e.g., clearing test data while keeping master configurations), **NEVER drop/recreate the entire database**, as it destroys users and shop settings. Instead, execute precise `DELETE` statements in the following foreign-key-safe order:
1. `SaleReturnItem`, `SaleReturn`, `SaleEditLog`, `DebtPayment`, `DebtInterest`, `SaleItem`, `Sale`
2. `GoodsReceiveItem`, `GoodsReceive`
3. `StockTransferItem`, `StockTransfer`, `StockWithdrawalItem`, `StockWithdrawal`
4. `FactoryReturnItem`, `FactoryReturn`
5. `QuotationItem`, `Quotation`
6. `StockTransaction`, `ProductStock`
7. `PointTransaction`, `UPDATE Customer SET "totalPoints" = 0`, `Expense`
8. `ProductLog`, `ProductBundleItem`, `ProductBundle`, `ProductPrice`, `ProductUnit`, `Product`, `ProductGroup`
*(Leaves User, Customer, CustomerGroup, Vendor, Warehouse, BankAccount, ReceiptTemplate, ShopInfo intact)*

### 🐛 Known Issue: Next.js "Server Components render" Error on Server Actions
If a Server Action throws an unhandled database error (e.g., `PrismaClientKnownRequestError: Unique constraint failed`), Next.js 14+ masks the error in production builds with the message:
`An error occurred in the Server Components render. The specific message is omitted in production builds...`

**Example Case 1:** `generateNumber.ts` had a typo mapping the prefix `TF` to a non-existent Prisma model `Transfer` (instead of `StockTransfer`). The function caught the `undefined` error silently and continuously returned the first number `TF-XXX-00000001`. The second transfer attempt violated the `@unique` constraint in the database, causing the action to fail and throw the masked Next.js error into the client's `AlertModal`.

**Example Case 2:** The prefix `ADJ` was mapped to a non-existent `StockAdjustment` model. The same fallback logic occurred, causing multiple separate adjustment groups to silently share identical IDs (`ADJ-2026-00000001`) without explicitly crashing, since `StockTransaction.reference` is not constrained by `@unique`. This is resolved by querying `StockTransaction` by the `reference` schema field.

### 💡 UI & Logic Implementation Details
- **P&L Report (`financial-reports.ts`)**: `factoryReturnAmount` (สินค้าเคลมคืนโรงงาน) is treated strictly as an informational stock movement. It is **not** subtracted from `grossProfit` or `netProfit` mathematically, preventing false business loss calculations.
- **Customer Modal (`customers/new/page.tsx`)**: Utilizes real-time debounced lookups against `/api/customers` mapping to a `<datalist>` to present auto-complete suggestions. It visually alerts users of exact string duplicates before submission.
- **POS Cart Bundles (`pos/page.tsx`)**: Bundle entities visually hide real bundle stock constraints (`availableStock: 9999`). User selection of a target `warehouseId` on a bundle row automatically propagates and overrides the `warehouseId` of all its internal `bundleItems` before reaching `createSaleFromPOS()`.
