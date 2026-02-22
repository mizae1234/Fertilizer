import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <Sidebar />
            <main className="lg:ml-64 pt-14 lg:pt-6 p-4 lg:p-6">
                {children}
            </main>
        </div>
    );
}
