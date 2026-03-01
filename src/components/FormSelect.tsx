'use client';

import React from 'react';

interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
    label?: string;
    error?: string;
    hint?: string;
    options: SelectOption[];
    placeholder?: string;
}

export default function FormSelect({
    label,
    error,
    hint,
    required,
    options,
    placeholder,
    id,
    ...props
}: FormSelectProps) {
    const selectId = id || `select-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`;

    return (
        <div>
            {label && (
                <label htmlFor={selectId} className="block text-sm font-medium text-gray-600 mb-1.5">
                    {label} {required && <span className="text-red-400">*</span>}
                </label>
            )}
            <select
                id={selectId}
                required={required}
                className={`w-full px-4 py-2.5 rounded-xl border ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-emerald-500'} focus:ring-2 focus:border-transparent outline-none text-sm`}
                {...props}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
    );
}
