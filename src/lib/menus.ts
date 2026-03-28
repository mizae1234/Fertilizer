// Shared menu definition used by both Sidebar and User Management forms
export const MENU_GROUPS = [
    {
        label: 'หลัก',
        items: [
            { name: 'Dashboard', href: '/', icon: '📊' },
            { name: 'POS ขายสินค้า', href: '/pos', icon: '🛒' },
            { name: 'รายการขาย', href: '/sales', icon: '💰' },
            { name: 'บิลค้างจ่าย', href: '/overdue-bills', icon: '📋' },
        ],
    },
    {
        label: 'จัดการข้อมูล',
        items: [
            { name: 'สินค้า', href: '/products', icon: '📦' },
            { name: 'ชุดสินค้า', href: '/bundles', icon: '🎁' },
            { name: 'คลังสินค้า', href: '/warehouses', icon: '🏭' },
            { name: 'ผู้ส่งสินค้า', href: '/vendors', icon: '🚚' },
            { name: 'ลูกค้า', href: '/customers', icon: '👥' },
            { name: 'กลุ่มลูกค้า', href: '/customer-groups', icon: '🏷️' },
            { name: 'Template บิล', href: '/settings/receipt-template', icon: '🧾' },
            { name: 'หมวดหมู่สินค้า', href: '/settings/product-groups', icon: '📦' },
            { name: 'บัญชีร้านค้า', href: '/bank-accounts', icon: '🏦' },
            { name: 'ข้อมูลร้าน', href: '/settings/shop-info', icon: '🏪' },
        ],
    },
    {
        label: 'เอกสาร',
        items: [
            { name: 'นำเข้าสินค้า', href: '/goods-receive', icon: '📥' },
            { name: 'โอนย้ายสินค้า', href: '/transfers', icon: '🔄' },
            { name: 'ปรับปรุง Stock', href: '/stock-adjustments', icon: '📉' },
            { name: 'เคลมคืนโรงงาน', href: '/factory-returns', icon: '🔙' },
            { name: 'เบิกสินค้า', href: '/stock-withdrawals', icon: '📤' },
            { name: 'ใบเสนอราคา', href: '/quotations', icon: '📋' },
            { name: 'บันทึกรายจ่าย', href: '/expenses', icon: '💸' },
        ],
    },
    {
        label: 'รายงาน',
        items: [
            { name: 'Owner Dashboard', href: '/owner-dashboard', icon: '🔮' },
            { name: 'รายงาน (Reports)', href: '/reports', icon: '📈' },
        ],
    },
];

// All assignable menu hrefs (excluding admin-only menus like /users)
export const ALL_MENU_HREFS = MENU_GROUPS.flatMap(g => g.items.map(i => i.href));
