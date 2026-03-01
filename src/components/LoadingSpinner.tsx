export default function LoadingSpinner({ message = 'กำลังโหลด...' }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">{message}</p>
        </div>
    );
}
