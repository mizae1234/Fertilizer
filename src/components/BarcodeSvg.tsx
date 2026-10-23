'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeSvgProps {
    value: string;
    width?: number;
    height?: number;
    fontSize?: number;
    displayValue?: boolean;
    format?: string;
    className?: string;
}

export default function BarcodeSvg({
    value,
    width = 1.4,
    height = 36,
    fontSize = 11,
    displayValue = true,
    format = 'CODE128',
    className = '',
}: BarcodeSvgProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || !value) return;
        try {
            JsBarcode(svgRef.current, value, {
                format,
                width,
                height,
                displayValue,
                fontSize,
                font: 'monospace',
                textMargin: 1,
                margin: 0,
            });
        } catch (err) {
            console.error('JsBarcode rendering error:', err);
        }
    }, [value, width, height, fontSize, displayValue, format]);

    if (!value) return null;

    return <svg ref={svgRef} className={className} />;
}
