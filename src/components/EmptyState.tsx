import React from 'react';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export default function EmptyState({
    icon = '📭',
    title,
    description,
    action,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <span className="text-4xl mb-1">{icon}</span>
            <p className="text-gray-500 font-medium">{title}</p>
            {description && <p className="text-sm text-gray-400 max-w-xs">{description}</p>}
            {action && <div className="mt-3">{action}</div>}
        </div>
    );
}
