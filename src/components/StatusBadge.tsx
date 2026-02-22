import { cn } from '@/lib/utils';

type StatusType = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

const statusConfig: Record<StatusType, { label: string; className: string }> = {
    DRAFT: { label: 'แบบร่าง', className: 'bg-gray-100 text-gray-600' },
    PENDING: { label: 'รออนุมัติ', className: 'bg-orange-100 text-orange-700' },
    APPROVED: { label: 'อนุมัติแล้ว', className: 'bg-emerald-100 text-emerald-700' },
    REJECTED: { label: 'ปฏิเสธ', className: 'bg-red-100 text-red-700' },
    CANCELLED: { label: 'ยกเลิกบิล', className: 'bg-gray-200 text-gray-500' },
};

interface StatusBadgeProps {
    status: string;
    className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = statusConfig[status as StatusType] || {
        label: status,
        className: 'bg-gray-100 text-gray-600',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
                config.className,
                className
            )}
        >
            {config.label}
        </span>
    );
}
