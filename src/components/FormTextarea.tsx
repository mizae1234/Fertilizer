'use client';

import React from 'react';

interface FormTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
    label?: string;
    error?: string;
    hint?: string;
}

export default function FormTextarea({
    label,
    error,
    hint,
    required,
    id,
    rows = 3,
    ...props
}: FormTextareaProps) {
    const textareaId = id || `textarea-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`;

    return (
        <div>
            {label && (
                <label htmlFor={textareaId} className="block text-sm font-medium text-gray-600 mb-1.5">
                    {label} {required && <span className="text-red-400">*</span>}
                </label>
            )}
            <textarea
                id={textareaId}
                required={required}
                rows={rows}
                className={`w-full px-4 py-2.5 rounded-xl border ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-emerald-500'} focus:ring-2 focus:border-transparent outline-none text-sm`}
                {...props}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
    );
}
