# Fertilizer POS — เอกสารโครงสร้างระบบและลอจิกการทำงาน (Codebase Reference)

เอกสารฉบับนี้ถูกสร้างขึ้นเพื่อสรุปโครงสร้างของโค้ด โลจิกการทำงาน (Function Logic) และสถาปัตยกรรมของระบบ Fertilizer POS ทั้งหมด เพื่อใช้เป็นคู่มืออ้างอิงในการพัฒนาและต่อยอดระบบแบบครบจบในที่เดียว

---

## 💻 Tech Stack (เทคโนโลยีที่ใช้)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL ควบคุมผ่าน Prisma 7 (`@prisma/adapter-pg`)
- **Styling**: Tailwind CSS
- **Authentication**: JWT (Cookie-based โดยใช้ `jsonwebtoken` + `bcryptjs`)
- **Deployment**: Docker + Caddy reverse proxy

---

## 📂 โครงสร้างโปรเจกต์ (Directory Structure)

```text
src/
├── app/
│   ├── (main)/          # ส่วนของหน้าเว็บที่มี Layout หลัก (มี Sidebar, Header) เช่น /pos, /products
│   ├── (print)/         # หน้าสำหรับปรินท์โดยเฉพาะ (ใบเสร็จ, ใบแจ้งหนี้, ใบเสนอราคา) ไม่มี Layout อื่นเจือปน
│   ├── actions/         # Server Actions สำหรับจัดการ Business Logic หลักกับ Database
│   ├── api/             # API Routes สำหรับทำงานแบบ RESTful (เช่น ดึงข้อมูลลูกค้าตอน search)
│   ├── login/           # หน้าต่าง Login
│   ├── layout.tsx       # Root layout และ Provider ต่างๆ
│   └── globals.css      # CSS หลัก (Tailwind directives)
├── components/          # Reusable UI Components (เช่น FormInput, AlertModal, Sidebar, DataTable)
├── generated/prisma/    # Prisma Client ที่ผ่านการ generate
├── hooks/               # Custom React Hooks (เช่น useUser ใช้ดึงข้อมูลและสิทธิ์ของผู้ใช้งาน)
├── lib/                 # Utility ฟังก์ชัน (การคำนวณ, Auth, utils.ts, prisma.ts)
├── types/               # TypeScript Interfaces/Types กลาง
└── middleware.ts        # การตรวจสอบสิทธิ์เข้าถึงหน้าเว็บ (Redirect ถ้ายังไม่ login)
```

---

## 🗄 โครงสร้างฐานข้อมูลหลัก (Core Models)

ฐานข้อมูลมีทั้งหมดประมาณ 28 โมเดล แบ่งการทำงานหลักๆ ได้ดังนี้:

1. **ผู้ใช้และร้านค้า (Auth & Shop)**
   - `User`: เก็บชื่อผู้ใช้ รหัสผ่าน สิทธิ์ (Role: ADMIN/STAFF) และเมนูที่อนุญาต (allowedMenus)
   - `ShopInfo` / `ReceiptTemplate` / `BankAccount`: เก็บการตั้งค่าของร้านค้า รูปแบบใบเสร็จ และบัญชีธนาคาร

2. **ระบบสินค้าและราคา (Products & Pricing)**
   - `Product` / `ProductGroup`: เก็บข้อมูลสินค้าพื้นฐาน
   - `ProductUnit`: รองรับการขายหลายหน่วย (มี conversionRate เทียบกับหน่วยฐาน)
   - `ProductPrice`: เก็บราคาสินค้าแยกตามกลุ่มลูกค้า (CustomerGroup) และแยกตามหน่วยขาย
   - `ProductStock`: จัดการสต็อกสินค้า โดยแยกระดับคลังสินค้า (WarehouseId)
   - `ProductBundle` / `ProductBundleItem`: จัดการสินค้าแบบจัดเซ็ต (Bundle)

3. **ระบบการขายและคืนสินค้า (Sales & Returns)**
   - `Sale` / `SaleItem`: เก็บบิลขาย รายการสินค้า ราคาส่วนลด และวิธีการชำระเงิน (JSON)
   - `SaleReturn` / `SaleReturnItem`: การทำเรื่องคืนสินค้า
   - `DebtPayment` / `DebtInterest`: การจัดการบิลที่ค้างชำระ (Credit) และการคิดดอกเบี้ย

4. **ระบบความเคลื่อนไหวสต็อก (Stock Transactions)**
   - `StockTransaction`: **(สำคัญมาก)** เก็บประวัติการเคลื่อนไหวของสต็อกทุกรูปแบบ (Sale, Goods Receive, Transfer, Withdrawal, Adjustment) เพื่อทำ Audit
   - `GoodsReceive` / `GoodsReceiveItem`: บันทึกการรับเข้าสินค้า (เข้าคลัง และคำนวณต้นทุนใหม่แบบ AVG/LAST/MANUAL)

---

## ⚙️ โลจิกและฟังก์ชันการทำงานหลัก (Core Business Logic)

### 1. ระบบขายสินค้าหน้าร้าน (POS Flow - `pos/page.tsx` & `actions/pos.ts`)
- **UI Logic**: หน้าต่าง POS จะดึงสินค้าและเก็บ state ลงใน `sessionStorage` (ตะกร้าสินค้า `cart` และลูกค้า `selectedCustomer`) เพื่อไม่ให้ข้อมูลหายเมื่อเผลอรีเฟรชหน้า มีการปรับ UX โดยใช้การกรอกตัวเลขจำนวนโดยตรง (ไม่มีปุ่ม +/-) และบังคับไม่ให้เลือกชำระแบบ "ค้างชำระ" (CREDIT) หากเป็นลูกค้าทั่วไป
- **Pricing Logic**: ทันทีที่มีการเลือกลูกค้า ระบบจะดึง `customerGroupId` เพื่อนำไปเช็คกับ `ProductPrice` หากพบราคาพิเศษ จะอัปเดตราคาในตะกร้าอัตโนมัติ (และคิดแยกตาม `ProductUnit` ที่เลือกด้วย)
- **Bundle Logic**: ชุดสินค้าจะถูกนำมาคำนวณราคาของแต่ละชิ้นข้างในเฉลี่ยตามสัดส่วน (Proportion calculation) เพื่อให้ยอดรวมเท่ากับ `bundlePrice` พอดี ลดปัญหาเรื่องทศนิยมไม่ลงตัว
- **Submit Logic**: เมื่อกดชำระเงิน จะส่งเข้า `createSaleFromPOS` (Server Action) เพื่อ:
  1. สร้างบิล `Sale`
  2. ตัดสต็อกโดยคูณ `quantity` กับ `conversionRate`
  3. บันทึก `StockTransaction` (ประเภท SALE)
  4. เพิ่มแต้ม (Points) ให้กับลูกค้า

### 2. การจัดการต้นทุนและการรับสินค้า (Goods Receive - `actions/goods-receive.ts`)
- ฟังก์ชัน `approveGoodsReceive` ทำหน้าที่รับของเข้าสต็อก พร้อมปรับปรุงราคาต้นทุนของสินค้า 
- รองรับการตั้งค่าวิธีคำนวณต้นทุน (Cost Method):
  - **AVG**: นำต้นทุนเดิมที่มีในสต็อกมาถัวเฉลี่ยกับของล็อตใหม่แบบถ่วงน้ำหนัก (Weighted Average)
  - **LAST**: ยึดราคาต้นทุนจากล็อตที่รับเข้าล่าสุด
  - **MANUAL**: ไม่เปลี่ยนต้นทุนเดิม

### 3. ระบบผู้ใช้งานและสิทธิ์ (Auth & Middleware)
- ใช้ JWT เก็บใน Cookie เพื่อระบุตัวตน 
- `middleware.ts` จะป้องกันไม่ให้ผู้ใช้ที่ไม่มี Cookie หลุดเข้ามาในระบบ 
- ในส่วน UI Component (เช่น `Sidebar`) จะใช้ Hook `useUser` ดึงข้อมูล `allowedMenus` เพื่อซ่อนเมนูที่ STAFF ไม่มีสิทธิ์เห็น

### 4. การค้นหาข้อมูลแบบ Real-time API Search (Dropdowns & Validation)
- เนื่องจากข้อจำกัดเรื่อง Pagination (เช่น โหลดแค่ 50 รายการแรก) การค้นหาข้อมูลลูกค้าและผู้ขายในหน้าแก้ไขบิล (`sales/[id]/page.tsx`) และหน้ารับสินค้า (`goods-receive/[id]/page.tsx`) จึงใช้ **Debounce** ยิง API ค้นหาแบบ Real-time แทนการฟิลเตอร์ฝั่ง Client เพื่อให้มั่นใจว่าจะเจอข้อมูลครบถ้วน
- ในหน้า `customers/new/page.tsx` ใช้เทคนิคเดียวกันเพื่อเตือนบน UI แบบ Real-time ว่าชื่อลูกค้าที่กำลังพิมพ์ ซ้ำกับในระบบหรือไม่ (`isDuplicate`) ช่วยลดความผิดพลาดในการสร้างลูกค้าซ้ำ

### 5. การประมวลผลสถานะการชำระเงิน (Sales List Status)
- ในหน้ารายการขาย (`sales/page.tsx`) มีการคำนวณสถานะบิลแยกเป็น **ชำระแล้ว**, **ค้างชำระ** และ **ยกเลิกบิล**
- คำนวณแบบ Real-time จากฝั่ง Server Component ผ่าน Prisma query (ดึง `paymentMethod`, `payments`, `debtPayments` และ `debtInterests`) โดยไม่ต้องสร้าง Request หรือ JOIN พิเศษใดๆ เพิ่ม เพื่อประเมินยอดหนี้คงเหลือ (`remaining = grandTotal - totalPaid`)

### 6. การค้นหารายการขาย (Sales Search)
- หน้ารายการขาย (`sales/page.tsx`) รองรับการค้นหาแบบ Multi-field ด้วย Prisma `OR` condition
- ฟิลด์ที่ค้นหาได้: **เลขที่บิล** (`saleNumber`), **ชื่อลูกค้า** (`customer.name`), **มูลค่าบิล** (`totalAmount`)
- กรณีค้นหา `totalAmount`: ใช้ `Prisma.Decimal` แปลงค่าก่อน หากค่าที่พิมพ์ไม่ใช่ตัวเลขจะ skip เงื่อนไขนี้อัตโนมัติ

### 7. การเรียงลำดับสต็อกสินค้า (Product Stock Sorting)
- ทุกที่ที่แสดงสต็อกสินค้าแยกตามคลัง จะเรียงตาม **Warehouse** ด้วย Logic เดียวกันทั้งระบบ:
  1. **`isMain: 'desc'`** — คลังหลัก (Main Warehouse) ขึ้นก่อนเสมอ
  2. **`name: 'asc'`** — คลังรองเรียงตามตัวอักษร A-Z / ก-ฮ
- ครอบคลุมทุกจุด:
  - หน้ารายการสินค้า (`products/page.tsx`)
  - API รายละเอียดสินค้า (`api/products/[id]/route.ts`)
  - API Export Excel สินค้า (`api/products/export/route.ts`)

### 8. การคำนวณกำไรสุทธิ (Net Profit Calculation)

#### หลักการคำนวณ
กำไรสุทธิ (Net Profit) = ยอดขายรวม (Revenue) − ต้นทุนขาย (COGS) − ค่าใช้จ่าย (Expenses)

- **Revenue** = `Sale.totalAmount` (หลังหักส่วนลดท้ายบิลแล้ว ตรงนี้ Database เก็บค่าสุทธิไว้แล้ว)
- **COGS** = Σ (netQty × conversionRate × unitCost) สำหรับแต่ละ SaleItem ที่ไม่ถูกคืน
- **Expenses** = Σ ค่าใช้จ่ายทั้งหมดในช่วงเวลา (จากตาราง `Expense`)

#### การหักรายการคืนสินค้า (Sale Returns)
- ทุกจุดที่คำนวณ COGS และจำนวนชิ้นขาย ต้องหักจำนวนชิ้นที่ลูกค้าคืนออกก่อนเสมอ
- **Logic:**
  ```
  returnedQty = Σ SaleReturnItem.quantity ที่ saleItemId ตรงกัน
  netQty = max(0, SaleItem.quantity - returnedQty)
  ```
- ครอบคลุม: `api/owner-dashboard/route.ts` (Owner Dashboard)

#### การกระจายส่วนลดรายบิล (Proportional Discount Distribution)
- กรณีบิลมี `discount` ท้ายบิล (Bill-level discount) จะกระจายส่วนลดนั้นไปยังแต่ละสินค้าตามสัดส่วนมูลค่า
- **Logic (ใช้ใน Per-item P&L Report):**
  ```
  billGrossRevenue = Σ (netQty × unitPrice) ทุกรายการในบิล
  itemDiscount = (grossItemRevenue / billGrossRevenue) × billDiscount
  itemNetRevenue = grossItemRevenue - itemDiscount
  itemProfit = itemNetRevenue - (netQty × rate × unitCost)
  ```
- ครอบคลุม: `actions/reports/financial-reports.ts` → ฟังก์ชัน `getPnLDetail()` ส่วน `byItem`

#### สรุปความแตกต่างของแต่ละรายงาน
| รายงาน | Revenue | COGS | ส่วนลด |
|---|---|---|---|
| Owner Dashboard (กำไรสุทธิ) | `totalAmount` (สุทธิ) | netQty × unitCost (หักคืนแล้ว) | รวมอยู่ใน Revenue แล้ว |
| P&L ภาพรวม (`getPnLReport`) | `totalAmount` (สุทธิ) | netQty × unitCost (หักคืนแล้ว) | รวมอยู่ใน Revenue แล้ว |
| P&L รายบิล (`byBill`) | `totalAmount` (สุทธิ) | netQty × unitCost (หักคืนแล้ว) | รวมอยู่ใน Revenue แล้ว |
| P&L รายชิ้น (`byItem`) | netQty × unitPrice − itemDiscount | netQty × unitCost (หักคืนแล้ว) | กระจายตามสัดส่วน |

---

## 💡 Best Practices & จุดที่ต้องระวังในการแก้ไขโค้ด

1. **Atomic Transactions**:
   - ทุกครั้งที่มีการแก้ไขบิล ตัดสต็อก หรือสร้างรายการที่มีความเกี่ยวเนื่องกันหลายตาราง ระบบจะหุ้มคำสั่งด้วย `prisma.$transaction()` เพื่อให้แน่ใจว่าถ้าเกิดข้อผิดพลาด 중간ทาง ข้อมูลจะถูก Rollback กลับทั้งหมด (ป้องกันปัญหาสต็อกหายแต่บิลไม่ขึ้น)

2. **ความเชื่อมโยงของสต็อก (Stock Flow)**:
   - **ห้ามแก้ไขค่าสต็อกโดยตรง** จากในตาราง `ProductStock` นอกเสียจากว่ากำลังเขียน Script เพื่อซ่อมแซมข้อมูล 
   - ทุกๆ การเพิ่มลดสต็อกผ่านแอปพลิเคชัน จะต้องสร้าง Record ลงในตาราง `StockTransaction` เสมอ เพื่อให้หน้ารายงานความเคลื่อนไหว (Stock Reports) มีข้อมูลที่ตรงกับตัวเลขสต็อกคงเหลือ

3. **เลขรันเอกสาร (Document Running Number)**:
   - ฟังก์ชัน `generateNumber(prefix)` (ใน `src/lib/generateNumber.ts`) ถูกสร้างขึ้นเพื่อเจนเลขบิลต่างๆ (เช่น `SL-2026-00000001`) โลจิกนี้มีกลไกตรวจสอบการชนกันของเลขบิล (Collision Retry) อยู่แล้ว แต่อย่าลืมตรวจสอบ Prefix ใน Schema ก่อนว่าเชื่อมกับโมเดลไหนบ้าง

4. **ข้อควรระวังเรื่องการลบข้อมูล (Soft Delete)**:
   - ตารางเกือบทั้งหมดจะใช้ฟิลด์ `deletedAt` (Soft Delete) แทนการลบหายไปจากฐานข้อมูล เพื่อรักษา Integrity ของข้อมูลในอดีต เวลา Query ข้อมูลจะต้องใส่เงื่อนไข `deletedAt: null` ไว้เสมอ

5. **Server Components vs Client Components**:
   - ฝั่งที่ต้องมี Interaction (เช่น ปุ่ม, Form, Modal) ต้องใส่ `'use client'` ไว้บรรทัดแรก 
   - งานดึงข้อมูลใหญ่ๆ (เช่น ดึงข้อมูลสรุปบน Dashboard) ควรทำฝั่ง Server เพื่อความรวดเร็วและลดการส่งข้อมูลไปฝั่ง Client

---

**อัปเดตล่าสุด:** พฤษภาคม 2026
*ไฟล์นี้สามารถใช้เป็นคู่มืออ้างอิงและ Onboard นักพัฒนาใหม่เข้าสู่ระบบได้ทันที*
