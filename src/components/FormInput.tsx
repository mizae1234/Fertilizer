'use client';

import React from 'react';

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
    label?: string;
    error?: string;
    hint?: string;
    /** datalist suggestions */
    suggestions?: string[];
    /** datalist id (auto-generated if not provided) */
    datalistId?: string;
}

export default function FormInput({
    label,
    error,
    hint,
    required,
    suggestions,
    datalistId,
    id,
    ...props
}: FormInputProps) {
    const inputId = id || `input-${label?.replace(/\s+/g, '-').toLowerCase() || 'field'}`;
    const listId = datalistId || (suggestions ? `${inputId}-suggestions` : undefined);

    return (
        <div>
            {label && (
                <label htmlFor={inputId} className="block text-sm font-medium text-gray-600 mb-1.5">
                    {label} {required && <span className="text-red-400">*</span>}
                </label>
            )}
            <input
                id={inputId}
                required={required}
                list={listId}
                className={`w-full px-4 py-2.5 rounded-xl border ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-emerald-500'} focus:ring-2 focus:border-transparent outline-none text-sm`}
                {...props}
            />
            {suggestions && listId && (
                <datalist id={listId}>
                    {suggestions.map((s) => (
                        <option key={s} value={s} />
                    ))}
                </datalist>
            )}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
    );
}
