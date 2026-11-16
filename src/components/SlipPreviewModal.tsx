import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Printer,
  X,
} from 'lucide-react';
import { BillRecord, PrintFormat, StoreSettings } from '../types/khata';
import { generateSlipPngBlob } from '../utils/slipImage';
import {
  buildWhatsAppBillText,
  formatRs,
  normalizePhoneForWhatsApp,
} from '../utils/storage';
import {
  translateNameToUrdu,
  translateStatusToUrdu,
  translateUnitToUrdu,
  URDU_STORE_INFO,
} from '../utils/urduTranslate';

interface SlipPreviewModalProps {
  bill: BillRecord | null;
  settings: StoreSettings;
  previousBaqaya?: number;
  onClose: () => void;
  onChangePrintFormat?: (format: PrintFormat) => void;
}

export const SlipPreviewModal: React.FC<SlipPreviewModalProps> = ({
  bill,
  settings,
  previousBaqaya = 0,
  onClose,
  onChangePrintFormat,
}) => {
  const [copied, setCopied] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [format, setFormat] = useState<PrintFormat>(settings.printFormat || 'a4');
  const [slipLang, setSlipLang] = useState<'ur' | 'en'>('ur');

  if (!bill) return null;

  const handleFormatSwitch = (next: PrintFormat) => {
    setFormat(next);
    onChangePrintFormat?.(next);
  };

  const isUrdu = slipLang === 'ur';

  const whatsappText = isUrdu
    ? [
        `*${URDU_STORE_INFO.storeName}*`,
        URDU_STORE_INFO.address,
        `موبائل: ${settings.phone1} / ${settings.phone2}`,
        ...(settings.email ? [`ای میل: ${settings.email}`] : []),
        '--------------------------------',
        `${bill.docType === 'Quotation' ? 'کوٹیشن نمبر' : 'بل نمبر'}: ${bill.billNo}`,
        `تاریخ: ${bill.date}`,
        `گاہک: ${bill.customerName || 'کیش گاہک'}`,
        ...(bill.customerPhone ? [`فون: ${bill.customerPhone}`] : []),
        '--------------------------------',
        ...bill.items.map((item, idx) => {
          const codeTag = item.code ? `[${item.code}] ` : '';
          const uName = translateNameToUrdu(item.name);
          const uUnit = translateUnitToUrdu(item.unitLabel);
          return `${idx + 1}. ${codeTag}${uName} (${uUnit})\n   ${item.qty} × ${Math.round(item.rate).toLocaleString('en-PK')} = *روپے ${Math.round(item.total).toLocaleString('en-PK')}*`;
        }),
        '--------------------------------',
        `کل رقم: روپے ${Math.round(bill.subtotal).toLocaleString('en-PK')}`,
        ...(bill.discountAmount > 0
          ? [`رعایت: -روپے ${Math.round(bill.discountAmount).toLocaleString('en-PK')}`]
          : []),
        `*مجموعی بل: روپے ${Math.round(bill.grandTotal).toLocaleString('en-PK')}*`,
        ...(bill.docType === 'Bill'
          ? [
              `وصول شدہ: روپے ${Math.round(bill.receivedAmount).toLocaleString('en-PK')}`,
              `*بقایا رقم: روپے ${Math.round(bill.remainingBalance).toLocaleString('en-PK')}*`,
              `حالت: ${translateStatusToUrdu(bill.paymentStatus)}`,
              ...(previousBaqaya > 0
                ? [`پچھلا کھاتہ بقایا: روپے ${Math.round(previousBaqaya).toLocaleString('en-PK')}`]
                : []),
            ]
          : []),
        '--------------------------------',
        URDU_STORE_INFO.footerNote,
      ].join('\n')
    : buildWhatsAppBillText(bill, settings, previousBaqaya);

  const waPhone = normalizePhoneForWhatsApp(bill.customerPhone);
  const waChatHref = waPhone ? `https://wa.me/${waPhone}` : 'https://wa.me/';

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleSaveSlipImage = async () => {
    try {
      setDownloadingImage(true);
      setShareNotice(null);
      const { blob, fileName } = await generateSlipPngBlob({
        bill,
        settings,
        format,
        lang: slipLang,
        previousBaqaya,
      });
      triggerDownload(blob, fileName);
      setShareNotice(`Slip image saved (${fileName}).`);
      setTimeout(() => setShareNotice(null), 3500);
    } catch {
      setShareNotice('Could not generate slip image.');
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleWhatsAppImageShare = async () => {
    try {
      setSharingImage(true);
      setShareNotice(null);
      const { blob, fileName } = await generateSlipPngBlob({
        bill,
        settings,
        format,
        lang: slipLang,
        previousBaqaya,
      });
      const file = new File([blob], fileName, { type: 'image/png' });

      const navWithShare = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (navWithShare.share && navWithShare.canShare?.({ files: [file] })) {
        try {
          await navWithShare.share({
            files: [file],
            title: `${settings.storeName} — ${bill.billNo}`,
            text: `${bill.customerName || 'Customer'} (${bill.billNo})`,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          // Fall through to clipboard/download fallback
        }
      }

      // Desktop / fallback: copy image to clipboard (if supported) + download PNG
      let copiedImg = false;
      if (
        typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard &&
        'write' in navigator.clipboard
      ) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          copiedImg = true;
        } catch {
          copiedImg = false;
        }
      }

      triggerDownload(blob, fileName);
      setShareNotice(
        copiedImg
          ? 'Slip image copied & downloaded! Open WhatsApp and paste (Ctrl+V) or attach the downloaded PNG.'
          : 'Slip PNG image downloaded! Open WhatsApp and attach the saved image.'
      );
    } catch {
      setShareNotice('Could not create slip image. Please try Print / PDF.');
    } finally {
      setSharingImage(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback ignored
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:static print:bg-white print:p-0 print:block"
      role="dialog"
      aria-modal="true"
      aria-label="Print Slip Preview"
    >
      <div
        className="w-full max-w-3xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Top Action Toolbar (Hidden when printing) */}
        <div
          className="no-print flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 border-b"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1 p-1 rounded-lg border"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                onClick={() => handleFormatSwitch('a4')}
                className="min-h-[34px] px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
                style={{
                  backgroundColor: format === 'a4' ? 'var(--accent)' : 'transparent',
                  color: format === 'a4' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                A4 / A5
              </button>
              <button
                type="button"
                onClick={() => handleFormatSwitch('thermal')}
                className="min-h-[34px] px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
                style={{
                  backgroundColor: format === 'thermal' ? 'var(--accent)' : 'transparent',
                  color: format === 'thermal' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                80mm Thermal
              </button>
            </div>

            <div
              className="flex items-center gap-1 p-1 rounded-lg border"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                onClick={() => setSlipLang('ur')}
                className="min-h-[34px] px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  backgroundColor: isUrdu ? 'var(--accent)' : 'transparent',
                  color: isUrdu ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                اردو سلپ
              </button>
              <button
                type="button"
                onClick={() => setSlipLang('en')}
                className="min-h-[34px] px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
                style={{
                  backgroundColor: !isUrdu ? 'var(--accent)' : 'transparent',
                  color: !isUrdu ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                English
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
              title="Copy text summary"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSlipImage}
              disabled={downloadingImage}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              {downloadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Save Image</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppImageShare}
              disabled={sharingImage}
              className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {sharingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MessageCircle className="w-3.5 h-3.5" />
              )}
              <span>WhatsApp Slip Image</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {shareNotice && (
          <div
            className="no-print px-4 py-2.5 border-b bg-emerald-500/10 border-emerald-500/30 text-xs flex flex-wrap items-center justify-between gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <span>{shareNotice}</span>
            <a
              href={waChatHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Open WhatsApp Chat</span>
            </a>
          </div>
        )}

        {/* Printable Paper Area (Always crisp white paper & black ink) */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 print:bg-white print:p-0 print:overflow-visible">
          {isUrdu ? (
            /* URDU PRINT SLIP */
            <div
              dir="rtl"
              className={`print-slip-container bg-white text-slate-900 mx-auto border border-slate-300 shadow-sm ${
                format === 'thermal'
                  ? 'max-w-[340px] p-4 text-xs'
                  : 'max-w-[740px] p-6 sm:p-8 text-sm'
              }`}
              style={{ fontFamily: "'Noto Naskh Arabic', 'Plus Jakarta Sans', sans-serif" }}
            >
              {/* Store Header in Urdu */}
              <div className="text-center border-b-2 border-slate-900 pb-3.5 mb-4">
                <h1
                  className={`font-bold text-slate-950 py-1 ${
                    format === 'thermal' ? 'text-xl leading-loose' : 'text-3xl leading-loose'
                  }`}
                  style={{ fontFamily: "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif" }}
                >
                  {URDU_STORE_INFO.storeName}
                </h1>
                <p className="text-slate-700 font-medium mt-1">{URDU_STORE_INFO.address}</p>
                <div
                  dir="ltr"
                  className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 mt-1.5 font-mono-num text-xs text-slate-800"
                >
                  <span>{settings.phone1}</span>
                  <span>·</span>
                  <span>{settings.phone2}</span>
                </div>
                {settings.email && (
                  <p dir="ltr" className="text-xs text-slate-600 mt-0.5 font-mono-num">
                    {settings.email}
                  </p>
                )}
              </div>

              {/* Bill Metadata in Urdu */}
              <div
                className={`grid gap-2 pb-3 mb-3 border-b border-slate-300 ${
                  format === 'thermal' ? 'grid-cols-1 text-xs' : 'grid-cols-2 text-sm'
                }`}
              >
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-500">گاہک کا نام: </span>
                    <strong className="text-slate-900">
                      {bill.customerName || 'کیش گاہک'}
                    </strong>
                  </div>
                  {bill.customerPhone && (
                    <div className="text-xs text-slate-700">
                      <span>فون نمبر: </span>
                      <span dir="ltr" className="font-mono-num inline-block">
                        {bill.customerPhone}
                      </span>
                    </div>
                  )}
                </div>
                <div className={`space-y-1 ${format === 'thermal' ? '' : 'text-left'}`}>
                  <div>
                    <span className="text-slate-500">
                      {bill.docType === 'Quotation' ? 'کوٹیشن نمبر: ' : 'بل نمبر: '}
                    </span>
                    <strong dir="ltr" className="font-mono-num inline-block">
                      {bill.billNo}
                    </strong>
                  </div>
                  <div className="text-xs text-slate-700">
                    <span>تاریخ: </span>
                    <span dir="ltr" className="font-mono-num inline-block">
                      {bill.date}
                    </span>
                    <span> · </span>
                    <span>
                      {bill.docType === 'Quotation'
                        ? translateStatusToUrdu('Quotation')
                        : translateStatusToUrdu(bill.paymentStatus)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Urdu Items Table */}
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="border-b border-slate-800 text-right text-xs text-slate-700">
                    <th className="py-2 pl-2">#</th>
                    <th className="py-2 pl-2">رنگ / تفصیل آئٹم</th>
                    <th className="py-2 pl-2">پیک / وزن</th>
                    <th className="py-2 text-left pl-2">تعداد</th>
                    <th className="py-2 text-left pl-2">ریٹ</th>
                    <th className="py-2 text-left">رقم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bill.items.map((item, idx) => {
                    const urduName = translateNameToUrdu(item.name);
                    const urduUnit = translateUnitToUrdu(item.unitLabel);
                    return (
                      <tr key={item.id} className="align-top">
                        <td className="py-2 pl-2 font-mono-num text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 pl-2">
                          <div className="flex items-center gap-1.5">
                            {item.swatchHex && (
                              <span
                                className="inline-block w-3 h-3 rounded-xs border border-slate-400 shrink-0 print:hidden"
                                style={{ backgroundColor: item.swatchHex }}
                              />
                            )}
                            <span className="font-semibold text-slate-900">
                              {item.code ? (
                                <span
                                  dir="ltr"
                                  className="font-mono-num font-bold ml-1.5 inline-block"
                                >
                                  [{item.code}]
                                </span>
                              ) : null}
                              {urduName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pl-2 text-slate-700 whitespace-nowrap">
                          {urduUnit}
                        </td>
                        <td dir="ltr" className="py-2 pl-2 text-left font-mono-num">
                          {item.qty}
                        </td>
                        <td dir="ltr" className="py-2 pl-2 text-left font-mono-num">
                          {Math.round(item.rate).toLocaleString('en-PK')}
                        </td>
                        <td dir="ltr" className="py-2 text-left font-mono-num font-semibold">
                          {Math.round(item.total).toLocaleString('en-PK')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Urdu Totals Breakdown */}
              <div className="border-t-2 border-slate-800 pt-3 flex flex-col items-end">
                <div className={format === 'thermal' ? 'w-full space-y-1.5' : 'w-72 space-y-1.5'}>
                  <div className="flex justify-between text-slate-700">
                    <span>کل رقم</span>
                    <span dir="ltr" className="font-mono-num">
                      Rs. {Math.round(bill.subtotal).toLocaleString('en-PK')}
                    </span>
                  </div>
                  {bill.discountAmount > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>
                        رعایت {bill.discountType === '%' ? `(${bill.discountValue}%)` : ''}
                      </span>
                      <span dir="ltr" className="font-mono-num">
                        -Rs. {Math.round(bill.discountAmount).toLocaleString('en-PK')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-1.5 text-slate-950">
                    <span>مجموعی بل</span>
                    <span dir="ltr" className="font-mono-num">
                      Rs. {Math.round(bill.grandTotal).toLocaleString('en-PK')}
                    </span>
                  </div>
                  {bill.docType === 'Bill' && (
                    <>
                      <div className="flex justify-between text-slate-700">
                        <span>وصول شدہ رقم</span>
                        <span dir="ltr" className="font-mono-num">
                          Rs. {Math.round(bill.receivedAmount).toLocaleString('en-PK')}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-950 border-t border-dashed border-slate-300 pt-1">
                        <span>بقایا رقم</span>
                        <span dir="ltr" className="font-mono-num">
                          Rs. {Math.round(bill.remainingBalance).toLocaleString('en-PK')}
                        </span>
                      </div>
                      {previousBaqaya > 0 && (
                        <div className="flex justify-between text-xs text-slate-600 pt-0.5">
                          <span>کل کھاتہ بقایا</span>
                          <span dir="ltr" className="font-mono-num font-semibold">
                            Rs. {Math.round(previousBaqaya).toLocaleString('en-PK')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {bill.notes && (
                <div className="mt-4 pt-2 border-t border-slate-200 text-xs text-slate-600">
                  <strong>نوٹ:</strong> {bill.notes}
                </div>
              )}

              {/* Urdu Footer */}
              <div className="mt-6 pt-3 border-t border-slate-300 text-center text-xs text-slate-600 space-y-1">
                <p>{URDU_STORE_INFO.footerNote}</p>
                <p className="font-semibold text-slate-800">
                  {URDU_STORE_INFO.storeName} · عمرزئی، چارسدہ
                </p>
              </div>
            </div>
          ) : (
            /* ENGLISH PRINT SLIP */
            <div
              className={`print-slip-container bg-white text-slate-900 mx-auto border border-slate-300 shadow-sm ${
                format === 'thermal'
                  ? 'max-w-[330px] p-4 text-xs'
                  : 'max-w-[740px] p-6 sm:p-8 text-sm'
              }`}
            >
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                <h1
                  className={`font-bold tracking-tight uppercase text-slate-950 ${
                    format === 'thermal' ? 'text-lg' : 'text-2xl'
                  }`}
                >
                  {settings.storeName}
                </h1>
                <p className="text-slate-700 font-medium mt-0.5">{settings.address}</p>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 mt-1 font-mono-num text-xs text-slate-800">
                  <span>Mob: {settings.phone1}</span>
                  <span>·</span>
                  <span>{settings.phone2}</span>
                </div>
                {settings.email && (
                  <p className="text-xs text-slate-600 mt-0.5">Email: {settings.email}</p>
                )}
              </div>

              <div
                className={`grid gap-2 pb-3 mb-3 border-b border-slate-300 ${
                  format === 'thermal' ? 'grid-cols-1 text-xs' : 'grid-cols-2 text-sm'
                }`}
              >
                <div className="space-y-0.5">
                  <div>
                    <span className="text-slate-500">Customer: </span>
                    <strong className="text-slate-900">
                      {bill.customerName || 'Walk-in Customer'}
                    </strong>
                  </div>
                  {bill.customerPhone && (
                    <div className="font-mono-num text-xs text-slate-700">
                      Phone: {bill.customerPhone}
                    </div>
                  )}
                </div>
                <div className={`space-y-0.5 ${format === 'thermal' ? '' : 'text-right'}`}>
                  <div className="font-mono-num">
                    <span className="text-slate-500">
                      {bill.docType === 'Quotation' ? 'Quote #' : 'Bill #'}:{' '}
                    </span>
                    <strong>{bill.billNo}</strong>
                  </div>
                  <div className="font-mono-num text-xs text-slate-700">
                    Date: {bill.date} · {bill.docType === 'Quotation' ? 'Estimate' : bill.paymentStatus}
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-600">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Item / Colour</th>
                    <th className="py-1.5 pr-2">Pack</th>
                    <th className="py-1.5 text-right pr-2">Qty</th>
                    <th className="py-1.5 text-right pr-2">Rate</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bill.items.map((item, idx) => (
                    <tr key={item.id} className="align-top">
                      <td className="py-2 pr-2 font-mono-num text-xs text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1.5">
                          {item.swatchHex && (
                            <span
                              className="inline-block w-3 h-3 rounded-xs border border-slate-400 shrink-0 print:hidden"
                              style={{ backgroundColor: item.swatchHex }}
                            />
                          )}
                          <span className="font-medium text-slate-900">
                            {item.code ? (
                              <span className="font-mono-num font-bold mr-1">[{item.code}]</span>
                            ) : null}
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-slate-700 whitespace-nowrap">
                        {item.unitLabel}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono-num">{item.qty}</td>
                      <td className="py-2 pr-2 text-right font-mono-num">
                        {Math.round(item.rate).toLocaleString('en-PK')}
                      </td>
                      <td className="py-2 text-right font-mono-num font-semibold">
                        {Math.round(item.total).toLocaleString('en-PK')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t-2 border-slate-800 pt-3 flex flex-col items-end">
                <div className={format === 'thermal' ? 'w-full space-y-1' : 'w-64 space-y-1.5'}>
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal</span>
                    <span className="font-mono-num">{formatRs(bill.subtotal)}</span>
                  </div>
                  {bill.discountAmount > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>
                        Discount {bill.discountType === '%' ? `(${bill.discountValue}%)` : ''}
                      </span>
                      <span className="font-mono-num">-{formatRs(bill.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-1.5 text-slate-950">
                    <span>Grand Total</span>
                    <span className="font-mono-num">{formatRs(bill.grandTotal)}</span>
                  </div>
                  {bill.docType === 'Bill' && (
                    <>
                      <div className="flex justify-between text-slate-700">
                        <span>Received (Wasool)</span>
                        <span className="font-mono-num">{formatRs(bill.receivedAmount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-950 border-t border-dashed border-slate-300 pt-1">
                        <span>Remaining (Baqaya)</span>
                        <span className="font-mono-num">{formatRs(bill.remainingBalance)}</span>
                      </div>
                      {previousBaqaya > 0 && (
                        <div className="flex justify-between text-xs text-slate-600 pt-0.5">
                          <span>Total Khata Baqaya</span>
                          <span className="font-mono-num font-semibold">
                            {formatRs(previousBaqaya)}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {bill.notes && (
                <div className="mt-4 pt-2 border-t border-slate-200 text-xs text-slate-600">
                  <strong>Note:</strong> {bill.notes}
                </div>
              )}

              <div className="mt-6 pt-3 border-t border-slate-300 text-center text-xs text-slate-600 space-y-1">
                <p>{settings.footerNote}</p>
                <p className="font-medium text-slate-800">
                  {settings.storeName} · Umarzai, Charsadda
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
