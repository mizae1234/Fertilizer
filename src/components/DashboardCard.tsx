import { cn } from '@/lib/utils';

interface DashboardCardProps {
    title: string;
    value: string | number;
    icon: string;
    color?: 'emerald' | 'blue' | 'orange' | 'red' | 'purple';
    subtitle?: string;
}

const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
};

export default function DashboardCard({
    title,
    value,
    icon,
    color = 'emerald',
    subtitle,
}: DashboardCardProps) {
    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-3 sm:p-5 hover:shadow-lg transition-shadow duration-200">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0', colorMap[color])}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">{title}</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-800 mt-0.5 truncate">{value}</p>
                    {subtitle && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}
