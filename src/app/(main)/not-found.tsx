import Link from 'next/link';

export default function MainNotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
            <div className="text-7xl font-bold text-gray-200">404</div>
            <div className="text-5xl">🔍</div>
            <h2 className="text-xl font-bold text-gray-800">ไม่พบหน้าที่ค้นหา</h2>
            <p className="text-sm text-gray-500 max-w-md">
                หน้าที่คุณกำลังมองหาอาจถูกย้ายหรือไม่มีอยู่แล้ว
            </p>
            <Link
                href="/"
                className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 transition-all"
            >
                🏠 กลับหน้าหลัก
            </Link>
        </div>
    );
}
