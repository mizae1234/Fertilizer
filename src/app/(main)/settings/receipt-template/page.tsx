'use client';

import { useState, useEffect, useCallback } from 'react';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

interface TemplateData {
    id?: string;
    name: string;
    isDefault: boolean;
    showLogo: boolean;
    logoUrl: string | null;
    headerText: string;
    footerText: string;
    showBillNo: boolean;
    showVat: boolean;
    showQr: boolean;
    showStaff: boolean;
    showCustomer: boolean;
    paperSize: string;
}

const NEW_TEMPLATE = (): TemplateData => ({
    name: '',
    isDefault: false,
    showLogo: false,
    logoUrl: null,
    headerText: '',
    footerText: '',
    showBillNo: true,
    showVat: false,
    showQr: false,
    showStaff: true,
    showCustomer: true,
    paperSize: '58mm',
});

export default function ReceiptTemplatePage() {
    const [templates, setTemplates] = useState<TemplateData[]>([]);
    const [editing, setEditing] = useState<TemplateData | null>(null);
    const [original, setOriginal] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<TemplateData | null>(null);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string; type: 'success' | 'error'; title?: string }>({ open: false, message: '', type: 'success' });

    const loadTemplates = useCallback(async () => {
        const res = await fetch('/api/receipt-template');
        const data = await res.json();
        setTemplates(data);
        setEditing(null);
        setLoading(false);
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const isDirty = editing && JSON.stringify(editing) !== original;

    const startEdit = (tpl: TemplateData) => {
        setEditing({ ...tpl });
        setOriginal(JSON.stringify(tpl));
    };

    const startNew = () => {
        const tpl = NEW_TEMPLATE();
        setEditing(tpl);
        setOriginal(JSON.stringify(tpl));
    };

    const updateField = <K extends keyof TemplateData>(key: K, value: TemplateData[K]) => {
        setEditing(prev => prev ? { ...prev, [key]: value } : prev);
    };

    const handleSave = async () => {
        if (!editing) return;
        if (!editing.name.trim()) {
            setAlertModal({ open: true, message: 'กรุณาระบุชื่อ Template', type: 'error', title: 'ข้อมูลไม่ครบ' });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/receipt-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editing),
            });
            if (!res.ok) throw new Error('Failed');
            setAlertModal({ open: true, message: 'บันทึก Template สำเร็จ', type: 'success', title: 'สำเร็จ' });
            await loadTemplates();
        } catch {
            setAlertModal({ open: true, message: 'ไม่สามารถบันทึกได้', type: 'error', title: 'เกิดข้อผิดพลาด' });
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;
        try {
            await fetch(`/api/receipt-template?id=${deleteTarget.id}`, { method: 'DELETE' });
            setAlertModal({ open: true, message: 'ลบ Template สำเร็จ', type: 'success', title: 'สำเร็จ' });
            setDeleteTarget(null);
            if (editing?.id === deleteTarget.id) setEditing(null);
            await loadTemplates();
        } catch {
            setAlertModal({ open: true, message: 'ไม่สามารถลบได้', type: 'error', title: 'เกิดข้อผิดพลาด' });
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            setAlertModal({ open: true, message: 'รองรับเฉพาะ PNG/JPG', type: 'error', title: 'ไฟล์ไม่ถูกต้อง' });
            return;
        }
        if (file.size > 300 * 1024) {
            setAlertModal({ open: true, message: 'ขนาดไม่เกิน 300KB', type: 'error', title: 'ไฟล์ใหญ่เกินไป' });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 200;
                const scale = Math.min(1, maxW / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = imageData.data;
                for (let i = 0; i < d.length; i += 4) {
                    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    d[i] = d[i + 1] = d[i + 2] = gray;
                }
                ctx.putImageData(imageData, 0, 0);
                setEditing(prev => prev ? { ...prev, showLogo: true, logoUrl: canvas.toDataURL('image/png') } : prev);
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    const previewWidth = editing?.paperSize === 'A4' ? 560 : editing?.paperSize === '80mm' ? 480 : 384;

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">🧾 Template บิล</h1>
                    <p className="text-sm text-gray-500 mt-1">ตั้งค่ารูปแบบใบเสร็จ — สามารถสร้างได้หลาย Template</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={startNew}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 transition-all">
                        + สร้าง Template ใหม่
                    </button>
                </div>
            </div>

            {/* Template List */}
            {!editing && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-4">
                    {templates.length === 0 ? (
                        <div className="px-4 py-12 text-center text-gray-400">
                            <p className="text-lg mb-2">📄</p>
                            <p>ยังไม่มี Template</p>
                            <button onClick={startNew} className="mt-3 text-sm text-emerald-600 font-medium hover:underline">+ สร้าง Template แรก</button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {templates.map(tpl => (
                                <div key={tpl.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">🧾</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{tpl.name}</p>
                                            {tpl.isDefault && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Default</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {tpl.paperSize} · {tpl.showVat ? 'VAT' : 'ไม่มี VAT'} · {tpl.showQr ? 'QR' : 'ไม่มี QR'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEdit(tpl)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                            แก้ไข
                                        </button>
                                        <button onClick={() => setDeleteTarget(tpl)}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                                            ลบ
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Edit / Create Form */}
            {editing && (
                <>
                    {/* Action bar */}
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => setEditing(null)}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                            ← กลับ
                        </button>
                        <h2 className="text-sm font-semibold text-gray-700 flex-1">
                            {editing.id ? `แก้ไข: ${editing.name}` : 'สร้าง Template ใหม่'}
                        </h2>
                        <button onClick={handleSave} disabled={!isDirty || saving}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {/* Left: Settings */}
                        <div className="space-y-4">
                            {/* Template Name + Default */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">📛 ชื่อ Template</h3>
                                <input type="text" value={editing.name}
                                    onChange={e => updateField('name', e.target.value)}
                                    placeholder="เช่น Template หลัก, ใบเสร็จ A4..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm mb-3" />
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={editing.isDefault}
                                        onChange={e => updateField('isDefault', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                                    <span className="text-sm text-gray-600">ตั้งเป็น Template หลัก (Default)</span>
                                </label>
                            </div>

                            {/* Logo */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">🖼️ โลโก้ร้าน</h3>
                                <div className="flex items-start gap-4">
                                    <div className="flex-1 space-y-3">
                                        <input type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload}
                                            className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-600 hover:file:bg-emerald-100" />
                                        <p className="text-[10px] text-gray-400">PNG/JPG ไม่เกิน 300KB · Auto ขาวดำ</p>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={editing.showLogo}
                                                onChange={e => updateField('showLogo', e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                                            <span className="text-sm text-gray-600">แสดงโลโก้บนบิล</span>
                                        </label>
                                    </div>
                                    {editing.logoUrl && (
                                        <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                                            <img src={editing.logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Header */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">📝 Header ใบเสร็จ</h3>
                                <textarea value={editing.headerText}
                                    onChange={e => updateField('headerText', e.target.value)}
                                    rows={4}
                                    placeholder={"ร้านปุ๋ยเจริญผล\nสำนักงานใหญ่\nโทร 08x-xxx-xxxx\nเลขผู้เสียภาษี 0123456789"}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-mono resize-none" />
                            </div>

                            {/* Display Options */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">⚙️ การแสดงผลข้อมูล</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                        { key: 'showBillNo' as const, label: 'แสดงเลขที่บิล' },
                                        { key: 'showStaff' as const, label: 'แสดงชื่อพนักงานขาย' },
                                        { key: 'showVat' as const, label: 'แสดง VAT' },
                                        { key: 'showQr' as const, label: 'แสดง QR PromptPay' },
                                        { key: 'showCustomer' as const, label: 'แสดงข้อมูลลูกค้า' },
                                    ].map(opt => (
                                        <label key={opt.key} className="flex items-center gap-2 cursor-pointer py-1.5">
                                            <input type="checkbox" checked={editing[opt.key]}
                                                onChange={e => updateField(opt.key, e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500" />
                                            <span className="text-sm text-gray-600">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Footer ใบเสร็จ</h3>
                                <textarea value={editing.footerText}
                                    onChange={e => updateField('footerText', e.target.value)}
                                    rows={3}
                                    placeholder={"ขอบคุณที่อุดหนุน\nสินค้าซื้อแล้วไม่รับคืน"}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm font-mono resize-none" />
                            </div>

                            {/* Paper Size */}
                            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">📐 ขนาดกระดาษ</h3>
                                <div className="flex gap-2">
                                    {['58mm', '80mm', 'A4'].map(size => (
                                        <button key={size} type="button"
                                            onClick={() => updateField('paperSize', size)}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${editing.paperSize === size
                                                ? 'bg-emerald-500 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                                }`}>
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Preview */}
                        <div className="xl:sticky xl:top-4 xl:self-start">
                            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">👁️ Preview ใบเสร็จ ({editing.paperSize})</h3>
                                <div className="flex justify-center">
                                    <div style={{ width: `${previewWidth}px`, maxWidth: '100%' }}
                                        className="bg-white border-2 border-dashed border-gray-300 rounded-lg px-6 py-5 font-mono text-xs leading-relaxed">
                                        {editing.paperSize === 'A4' ? (
                                            /* A4 Preview */
                                            <div>
                                                <div className="flex justify-between mb-3">
                                                    <div className="flex gap-3 items-start">
                                                        {editing.showLogo && editing.logoUrl && (
                                                            <img src={editing.logoUrl} alt="logo" className="h-10 object-contain" />
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-sm">{editing.headerText?.split('\n')[0] || 'ชื่อร้าน'}</div>
                                                            {editing.headerText?.split('\n').slice(1).map((l, i) => (
                                                                <div key={i} className="text-[9px] text-gray-400">{l}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[9px] text-gray-400"># SALE-20260001</div>
                                                        <div className="font-bold text-xs mt-0.5">ใบส่งของ / ใบเสร็จรับเงิน</div>
                                                    </div>
                                                </div>
                                                <div className="border border-gray-300 rounded text-[9px] mb-3">
                                                    <div className="grid grid-cols-3 divide-x divide-gray-300">
                                                        <div className="p-1.5"><span className="text-gray-400">วันที่</span><br /><strong>21/02/2569</strong></div>
                                                        <div className="p-1.5"><span className="text-gray-400">รวมเงิน</span><br /><strong>฿1,890.00</strong></div>
                                                        <div className="p-1.5 text-center text-gray-500">(หนึ่งพันแปดร้อยเก้าสิบบาทถ้วน)</div>
                                                    </div>
                                                </div>
                                                <table className="w-full text-[9px] mb-3">
                                                    <thead><tr className="border-y-2 border-gray-800">
                                                        <th className="text-left py-1">บาร์โค้ด</th>
                                                        <th className="text-left py-1">สินค้า</th>
                                                        <th className="text-center py-1">จำนวน</th>
                                                        <th className="text-center py-1">หน่วย</th>
                                                        <th className="text-right py-1">ราคา</th>
                                                        <th className="text-right py-1">รวม</th>
                                                    </tr></thead>
                                                    <tbody>
                                                        <tr className="border-b border-gray-200"><td className="py-1">227</td><td className="py-1">ปุ๋ยยูเรีย 50kg</td><td className="text-center py-1">2</td><td className="text-center py-1">กระสอบ</td><td className="text-right py-1">800.00</td><td className="text-right py-1">1,600.00</td></tr>
                                                        <tr className="border-b border-gray-200"><td className="py-1">110</td><td className="py-1">ดินปลูก 20L</td><td className="text-center py-1">1</td><td className="text-center py-1">ถุง</td><td className="text-right py-1">290.00</td><td className="text-right py-1">290.00</td></tr>
                                                    </tbody>
                                                </table>
                                                <div className="flex justify-between text-[8px] text-gray-400 mt-6 pt-4">
                                                    {['ผู้รับของ', 'ผู้นำส่ง', 'ผู้รับเงิน', 'ผู้รับมอบอำนาจ'].map(l => (
                                                        <div key={l} className="text-center">
                                                            <div className="font-medium text-gray-600 mb-4">{l}</div>
                                                            <div>..............................</div>
                                                            <div>วันที่ ........................</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            /* 58mm/80mm Thermal Preview */
                                            <>
                                                {editing.showLogo && editing.logoUrl && (
                                                    <div className="flex justify-center mb-3">
                                                        <img src={editing.logoUrl} alt="logo" className="h-12 object-contain" />
                                                    </div>
                                                )}
                                                {editing.headerText && (
                                                    <div className="text-center whitespace-pre-wrap mb-2">{editing.headerText}</div>
                                                )}
                                                <div className="border-t border-dashed border-gray-400 my-2" />
                                                {editing.showBillNo && (
                                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                        <span>เลขที่: SALE-20260001</span><span>21/02/2569</span>
                                                    </div>
                                                )}
                                                {editing.showStaff && <div className="text-[10px] text-gray-500 mb-1">พนักงาน: สมชาย</div>}
                                                {editing.showCustomer && <div className="text-[10px] text-gray-500 mb-1">ลูกค้า: คุณสมหญิง</div>}
                                                <div className="border-t border-dashed border-gray-400 my-2" />
                                                <div className="space-y-1">
                                                    <div className="flex justify-between"><span>ปุ๋ยยูเรีย 50kg</span><span>x2</span><span className="text-right w-20">1,600.00</span></div>
                                                    <div className="flex justify-between"><span>ดินปลูก 20L</span><span>x1</span><span className="text-right w-20">290.00</span></div>
                                                </div>
                                                <div className="border-t border-dashed border-gray-400 my-2" />
                                                <div className="flex justify-between font-bold"><span>รวมทั้งสิ้น</span><span>1,890.00</span></div>
                                                {editing.showVat && (
                                                    <>
                                                        <div className="flex justify-between text-[10px] text-gray-500 mt-1"><span>มูลค่าก่อน VAT</span><span>1,766.36</span></div>
                                                        <div className="flex justify-between text-[10px] text-gray-500"><span>VAT 7%</span><span>123.64</span></div>
                                                    </>
                                                )}
                                                {editing.showQr && (
                                                    <div className="mt-3 flex flex-col items-center">
                                                        <div className="w-20 h-20 bg-gray-100 border border-gray-300 rounded flex items-center justify-center text-[9px] text-gray-400">QR Code<br />PromptPay</div>
                                                    </div>
                                                )}
                                                {editing.footerText && (
                                                    <>
                                                        <div className="border-t border-dashed border-gray-400 my-2" />
                                                        <div className="text-center whitespace-pre-wrap text-[10px] text-gray-500">{editing.footerText}</div>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="ยืนยันลบ Template"
                message={`ต้องการลบ Template "${deleteTarget?.name}" ใช่หรือไม่?`}
                confirmText="ลบ"
                variant="danger"
            />

            <AlertModal open={alertModal.open}
                onClose={() => setAlertModal(prev => ({ ...prev, open: false }))}
                message={alertModal.message} type={alertModal.type} title={alertModal.title} />
        </div>
    );
}
