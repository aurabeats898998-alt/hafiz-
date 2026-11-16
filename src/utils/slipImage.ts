import { BillRecord, PrintFormat, StoreSettings } from '../types/khata';
import { formatRs } from './storage';
import {
  translateNameToUrdu,
  translateStatusToUrdu,
  translateUnitToUrdu,
  URDU_STORE_INFO,
} from './urduTranslate';

export interface SlipImageOptions {
  bill: BillRecord;
  settings: StoreSettings;
  format: PrintFormat;
  lang: 'ur' | 'en';
  previousBaqaya?: number;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = text.trim();
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        // Hard-break ultra-long token
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateSlipPngBlob(
  options: SlipImageOptions
): Promise<{ blob: Blob; fileName: string }> {
  const { bill, settings, format, lang, previousBaqaya = 0 } = options;
  const isUrdu = lang === 'ur';
  const isThermal = format === 'thermal';

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font-loading errors
    }
  }

  const width = isThermal ? 680 : 1080;
  const pad = isThermal ? 32 : 52;
  const contentW = width - pad * 2;

  const fontSans = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  const fontMono = '"JetBrains Mono", ui-monospace, monospace';
  const fontUrdu = '"Noto Naskh Arabic", "Plus Jakarta Sans", sans-serif';
  const fontUrduTitle = '"Noto Nastaliq Urdu", "Noto Naskh Arabic", sans-serif';

  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 100;
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Column geometry
  // Thermal has compact columns; A4 has generous spacing
  const colIndexW = isThermal ? 34 : 46;
  const colAmtW = isThermal ? 104 : 148;
  const colRateW = isThermal ? 82 : 122;
  const colQtyW = isThermal ? 56 : 78;
  const colPackW = isThermal ? 92 : 138;
  const colNameW =
    contentW - colIndexW - colPackW - colQtyW - colRateW - colAmtW - 24;

  const itemFont = isUrdu
    ? `${isThermal ? '600 18px' : '600 22px'} ${fontUrdu}`
    : `${isThermal ? '600 17px' : '600 21px'} ${fontSans}`;
  const itemSubFont = isUrdu
    ? `${isThermal ? '500 16px' : '500 19px'} ${fontUrdu}`
    : `${isThermal ? '500 16px' : '500 19px'} ${fontSans}`;
  const rowLineH = isThermal ? 26 : 32;

  interface PreparedRow {
    idx: number;
    code?: string;
    swatchHex?: string;
    nameLines: string[];
    unitText: string;
    qtyText: string;
    rateText: string;
    totalText: string;
    rowHeight: number;
  }

  const preparedRows: PreparedRow[] = bill.items.map((item, idx) => {
    mctx.font = itemFont;
    const displayName = isUrdu ? translateNameToUrdu(item.name) : item.name;
    const prefixReserve = (item.swatchHex ? 24 : 0) + (item.code ? 74 : 0);
    const nameLines = wrapLines(
      mctx,
      displayName,
      Math.max(120, colNameW - prefixReserve)
    );
    const unitText = isUrdu
      ? translateUnitToUrdu(item.unitLabel)
      : item.unitLabel;
    const linesHeight = Math.max(1, nameLines.length) * rowLineH;
    const rowHeight = Math.max(isThermal ? 42 : 48, linesHeight + 18);
    return {
      idx: idx + 1,
      code: item.code,
      swatchHex: item.swatchHex,
      nameLines,
      unitText,
      qtyText: String(item.qty),
      rateText: Math.round(item.rate).toLocaleString('en-PK'),
      totalText: Math.round(item.total).toLocaleString('en-PK'),
      rowHeight,
    };
  });

  // Measure header lines
  const addressText = isUrdu ? URDU_STORE_INFO.address : settings.address;
  mctx.font = isUrdu
    ? `${isThermal ? '500 18px' : '500 21px'} ${fontUrdu}`
    : `${isThermal ? '500 17px' : '500 20px'} ${fontSans}`;
  const addressLines = wrapLines(mctx, addressText, contentW - 20);

  // Measure notes lines if any
  let noteLines: string[] = [];
  if (bill.notes.trim()) {
    mctx.font = isUrdu
      ? `500 ${isThermal ? 17 : 20}px ${fontUrdu}`
      : `500 ${isThermal ? 16 : 19}px ${fontSans}`;
    const noteFull = isUrdu ? `نوٹ: ${bill.notes}` : `Note: ${bill.notes}`;
    noteLines = wrapLines(mctx, noteFull, contentW - 12);
  }

  // Measure footer lines
  const footerText = isUrdu ? URDU_STORE_INFO.footerNote : settings.footerNote;
  mctx.font = isUrdu
    ? `400 ${isThermal ? 16 : 19}px ${fontUrdu}`
    : `400 ${isThermal ? 15 : 18}px ${fontSans}`;
  const footerLines = wrapLines(mctx, footerText, contentW - 16);

  // Compute exact height
  let totalH = pad;
  // Store title + address + phones + email + divider
  totalH += isUrdu ? (isThermal ? 56 : 74) : isThermal ? 38 : 48;
  totalH += addressLines.length * (isThermal ? 24 : 28) + 8;
  totalH += isThermal ? 24 : 28; // phone line
  if (settings.email) totalH += isThermal ? 22 : 26;
  totalH += 26; // divider + margin

  // Meta block (customer + bill info)
  totalH += isThermal ? (bill.customerPhone ? 104 : 82) : 68;
  totalH += 22;

  // Table header
  totalH += isThermal ? 38 : 44;
  // Table rows
  preparedRows.forEach((r) => {
    totalH += r.rowHeight;
  });
  totalH += 20;

  // Totals block
  let totalLinesCount = 2; // Subtotal + Grand Total
  if (bill.discountAmount > 0) totalLinesCount += 1;
  if (bill.docType === 'Bill') {
    totalLinesCount += 2; // Received + Remaining
    if (previousBaqaya > 0) totalLinesCount += 1;
  }
  totalH += totalLinesCount * (isThermal ? 32 : 38) + 28;

  // Notes
  if (noteLines.length > 0) {
    totalH += noteLines.length * (isThermal ? 24 : 28) + 24;
  }

  // Footer
  totalH += 24 + footerLines.length * (isThermal ? 22 : 26) + (isThermal ? 32 : 38);
  totalH += pad;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil(totalH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to initialize canvas context');
  }

  // White paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, canvas.height);

  // Crisp subtle paper border
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, canvas.height - 2);

  let y = pad;
  const centerX = width / 2;

  // --- HEADER ---
  ctx.fillStyle = '#020617';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (isUrdu) {
    ctx.direction = 'rtl';
    ctx.font = isThermal ? `700 30px ${fontUrduTitle}` : `700 42px ${fontUrduTitle}`;
    ctx.fillText(URDU_STORE_INFO.storeName, centerX, y);
    y += isThermal ? 56 : 74;
  } else {
    ctx.direction = 'ltr';
    ctx.font = isThermal ? `700 26px ${fontSans}` : `700 34px ${fontSans}`;
    ctx.fillText(settings.storeName.toUpperCase(), centerX, y);
    y += isThermal ? 38 : 48;
  }

  // Address
  ctx.fillStyle = '#334155';
  ctx.font = isUrdu
    ? `500 ${isThermal ? 18 : 21}px ${fontUrdu}`
    : `500 ${isThermal ? 17 : 20}px ${fontSans}`;
  ctx.direction = isUrdu ? 'rtl' : 'ltr';
  for (const line of addressLines) {
    ctx.fillText(line, centerX, y);
    y += isThermal ? 24 : 28;
  }
  y += 4;

  // Phones
  ctx.direction = 'ltr';
  ctx.fillStyle = '#1E293B';
  ctx.font = `600 ${isThermal ? 16 : 19}px ${fontMono}`;
  ctx.fillText(
    isUrdu
      ? `${settings.phone1}  ·  ${settings.phone2}`
      : `Mob: ${settings.phone1}  ·  ${settings.phone2}`,
    centerX,
    y
  );
  y += isThermal ? 24 : 28;

  if (settings.email) {
    ctx.fillStyle = '#475569';
    ctx.font = `400 ${isThermal ? 15 : 17}px ${fontMono}`;
    ctx.fillText(settings.email, centerX, y);
    y += isThermal ? 22 : 26;
  }

  y += 8;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 16;

  // --- METADATA ---
  const custDisplay =
    bill.customerName || (isUrdu ? 'کیش گاہک' : 'Walk-in Customer');
  const docLabel =
    bill.docType === 'Quotation'
      ? isUrdu
        ? 'کوٹیشن نمبر:'
        : 'Quote #:'
      : isUrdu
        ? 'بل نمبر:'
        : 'Bill #:';
  const statusDisplay = isUrdu
    ? translateStatusToUrdu(
        bill.docType === 'Quotation' ? 'Quotation' : bill.paymentStatus
      )
    : bill.docType === 'Quotation'
      ? 'Estimate'
      : bill.paymentStatus;

  if (isUrdu) {
    if (isThermal) {
      ctx.textAlign = 'right';
      ctx.direction = 'rtl';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 19px ${fontUrdu}`;
      ctx.fillText(`گاہک: ${custDisplay}`, width - pad, y);
      y += 26;
      if (bill.customerPhone) {
        ctx.fillStyle = '#475569';
        ctx.font = `500 16px ${fontMono}`;
        ctx.fillText(`فون: ${bill.customerPhone}`, width - pad, y);
        y += 22;
      }
      ctx.fillStyle = '#0F172A';
      ctx.font = `600 17px ${fontUrdu}`;
      ctx.fillText(`${docLabel} ${bill.billNo}`, width - pad, y);
      y += 24;
      ctx.fillStyle = '#475569';
      ctx.font = `500 16px ${fontUrdu}`;
      ctx.fillText(`تاریخ: ${bill.date}  ·  ${statusDisplay}`, width - pad, y);
      y += 28;
    } else {
      // A4 two-column RTL
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 22px ${fontUrdu}`;
      ctx.fillText(`گاہک کا نام: ${custDisplay}`, width - pad, y);
      if (bill.customerPhone) {
        ctx.fillStyle = '#475569';
        ctx.font = `500 18px ${fontMono}`;
        ctx.fillText(`فون: ${bill.customerPhone}`, width - pad, y + 32);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 22px ${fontUrdu}`;
      ctx.fillText(`${docLabel} ${bill.billNo}`, pad, y);
      ctx.fillStyle = '#475569';
      ctx.font = `500 18px ${fontUrdu}`;
      ctx.fillText(`تاریخ: ${bill.date}  ·  ${statusDisplay}`, pad, y + 32);
      y += 66;
    }
  } else {
    ctx.direction = 'ltr';
    if (isThermal) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 18px ${fontSans}`;
      ctx.fillText(`Customer: ${custDisplay}`, pad, y);
      y += 24;
      if (bill.customerPhone) {
        ctx.fillStyle = '#475569';
        ctx.font = `500 16px ${fontMono}`;
        ctx.fillText(`Phone: ${bill.customerPhone}`, pad, y);
        y += 22;
      }
      ctx.fillStyle = '#0F172A';
      ctx.font = `600 16px ${fontMono}`;
      ctx.fillText(`${docLabel} ${bill.billNo}`, pad, y);
      y += 22;
      ctx.fillStyle = '#475569';
      ctx.font = `500 15px ${fontMono}`;
      ctx.fillText(`Date: ${bill.date}  ·  ${statusDisplay}`, pad, y);
      y += 26;
    } else {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 21px ${fontSans}`;
      ctx.fillText(`Customer: ${custDisplay}`, pad, y);
      if (bill.customerPhone) {
        ctx.fillStyle = '#475569';
        ctx.font = `500 18px ${fontMono}`;
        ctx.fillText(`Phone: ${bill.customerPhone}`, pad, y + 30);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 21px ${fontMono}`;
      ctx.fillText(`${docLabel} ${bill.billNo}`, width - pad, y);
      ctx.fillStyle = '#475569';
      ctx.font = `500 18px ${fontMono}`;
      ctx.fillText(`Date: ${bill.date}  ·  ${statusDisplay}`, width - pad, y + 30);
      y += 66;
    }
  }

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 12;

  // --- TABLE HEADER & ROWS ---
  if (isUrdu) {
    // RTL column positions (from right to left)
    const xIdxR = width - pad;
    const xNameR = xIdxR - colIndexW;
    const xPackR = xNameR - colNameW - 8;
    const xQtyL = pad + colAmtW + colRateW + 12;
    const xRateL = pad + colAmtW + 6;
    const xAmtL = pad;

    ctx.fillStyle = '#334155';
    ctx.font = `700 ${isThermal ? 16 : 19}px ${fontUrdu}`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText('#', xIdxR, y);
    ctx.fillText('رنگ / تفصیل آئٹم', xNameR, y);
    ctx.fillText('پیک / وزن', xPackR, y);
    ctx.textAlign = 'left';
    ctx.fillText('تعداد', xQtyL, y);
    ctx.fillText('ریٹ', xRateL, y);
    ctx.fillText('رقم', xAmtL, y);

    y += isThermal ? 30 : 34;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    y += 10;

    preparedRows.forEach((row, rIdx) => {
      // Row index
      ctx.direction = 'ltr';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748B';
      ctx.font = `500 ${isThermal ? 15 : 18}px ${fontMono}`;
      ctx.fillText(String(row.idx), xIdxR, y + 3);

      // Swatch + Code badge + Name on right-to-left line
      let cursorR = xNameR;
      if (row.swatchHex) {
        const sw = isThermal ? 14 : 16;
        ctx.fillStyle = row.swatchHex;
        drawRoundedRect(ctx, cursorR - sw, y + 5, sw, sw, 3);
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1;
        ctx.stroke();
        cursorR -= sw + 8;
      }

      if (row.code) {
        const badgeText = `[${row.code}]`;
        ctx.direction = 'ltr';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0F172A';
        ctx.font = `700 ${isThermal ? 15 : 18}px ${fontMono}`;
        ctx.fillText(badgeText, cursorR, y + 3);
        const bw = ctx.measureText(badgeText).width;
        cursorR -= bw + 8;
      }

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = itemFont;
      row.nameLines.forEach((line, lIdx) => {
        const lineAnchor = lIdx === 0 ? cursorR : xNameR;
        ctx.fillText(line, lineAnchor, y + lIdx * rowLineH);
      });

      // Pack / Unit
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#334155';
      ctx.font = itemSubFont;
      ctx.fillText(row.unitText, xPackR, y);

      // Qty, Rate, Amount (LTR numbers aligned left in RTL table)
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = `500 ${isThermal ? 16 : 19}px ${fontMono}`;
      ctx.fillText(row.qtyText, xQtyL, y + 2);
      ctx.fillText(row.rateText, xRateL, y + 2);
      ctx.font = `700 ${isThermal ? 16 : 19}px ${fontMono}`;
      ctx.fillText(row.totalText, xAmtL, y + 2);

      y += row.rowHeight;
      if (rIdx < preparedRows.length - 1) {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y - 8);
        ctx.lineTo(width - pad, y - 8);
        ctx.stroke();
      }
    });
  } else {
    // LTR English columns
    const xIdxL = pad;
    const xNameL = xIdxL + colIndexW;
    const xPackL = xNameL + colNameW + 8;
    const xQtyR = width - pad - colAmtW - colRateW - 14;
    const xRateR = width - pad - colAmtW - 6;
    const xAmtR = width - pad;

    ctx.direction = 'ltr';
    ctx.fillStyle = '#475569';
    ctx.font = `700 ${isThermal ? 15 : 18}px ${fontSans}`;
    ctx.textAlign = 'left';
    ctx.fillText('#', xIdxL, y);
    ctx.fillText('ITEM / COLOUR', xNameL, y);
    ctx.fillText('PACK', xPackL, y);
    ctx.textAlign = 'right';
    ctx.fillText('QTY', xQtyR, y);
    ctx.fillText('RATE', xRateR, y);
    ctx.fillText('AMOUNT', xAmtR, y);

    y += isThermal ? 28 : 32;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    y += 10;

    preparedRows.forEach((row, rIdx) => {
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748B';
      ctx.font = `500 ${isThermal ? 15 : 18}px ${fontMono}`;
      ctx.fillText(String(row.idx), xIdxL, y + 2);

      let cursorL = xNameL;
      if (row.swatchHex) {
        const sw = isThermal ? 14 : 16;
        ctx.fillStyle = row.swatchHex;
        drawRoundedRect(ctx, cursorL, y + 4, sw, sw, 3);
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1;
        ctx.stroke();
        cursorL += sw + 8;
      }

      if (row.code) {
        const badgeText = `[${row.code}]`;
        ctx.fillStyle = '#0F172A';
        ctx.font = `700 ${isThermal ? 15 : 18}px ${fontMono}`;
        ctx.fillText(badgeText, cursorL, y + 2);
        cursorL += ctx.measureText(badgeText).width + 7;
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = itemFont;
      row.nameLines.forEach((line, lIdx) => {
        ctx.fillText(line, lIdx === 0 ? cursorL : xNameL, y + lIdx * rowLineH);
      });

      ctx.fillStyle = '#334155';
      ctx.font = itemSubFont;
      ctx.fillText(row.unitText, xPackL, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = `500 ${isThermal ? 16 : 19}px ${fontMono}`;
      ctx.fillText(row.qtyText, xQtyR, y + 1);
      ctx.fillText(row.rateText, xRateR, y + 1);
      ctx.font = `700 ${isThermal ? 16 : 19}px ${fontMono}`;
      ctx.fillText(row.totalText, xAmtR, y + 1);

      y += row.rowHeight;
      if (rIdx < preparedRows.length - 1) {
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y - 8);
        ctx.lineTo(width - pad, y - 8);
        ctx.stroke();
      }
    });
  }

  // --- TOTALS ---
  y += 6;
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 16;

  const boxW = isThermal ? contentW : 390;
  const boxLeft = isUrdu ? pad : width - pad - boxW;
  const boxRight = boxLeft + boxW;
  const rowStep = isThermal ? 32 : 38;

  const drawSummaryRow = (
    label: string,
    value: string,
    bold = false,
    topBorder = false,
    muted = false
  ) => {
    if (topBorder) {
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(boxLeft, y - 6);
      ctx.lineTo(boxRight, y - 6);
      ctx.stroke();
    }
    ctx.fillStyle = muted ? '#475569' : bold ? '#020617' : '#334155';
    if (isUrdu) {
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = `${bold ? '700' : '500'} ${isThermal ? (bold ? 20 : 18) : bold ? 23 : 20}px ${fontUrdu}`;
      ctx.fillText(label, boxRight, y);

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = `${bold ? '700' : '500'} ${isThermal ? (bold ? 19 : 17) : bold ? 22 : 19}px ${fontMono}`;
      ctx.fillText(value, boxLeft, y + 2);
    } else {
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = `${bold ? '700' : '500'} ${isThermal ? (bold ? 19 : 17) : bold ? 22 : 19}px ${fontSans}`;
      ctx.fillText(label, boxLeft, y);

      ctx.textAlign = 'right';
      ctx.font = `${bold ? '700' : '500'} ${isThermal ? (bold ? 19 : 17) : bold ? 22 : 19}px ${fontMono}`;
      ctx.fillText(value, boxRight, y);
    }
    y += rowStep;
  };

  drawSummaryRow(isUrdu ? 'کل رقم' : 'Subtotal', formatRs(bill.subtotal));
  if (bill.discountAmount > 0) {
    const discLabel = isUrdu
      ? `رعایت ${bill.discountType === '%' ? `(${bill.discountValue}%)` : ''}`
      : `Discount ${bill.discountType === '%' ? `(${bill.discountValue}%)` : ''}`;
    drawSummaryRow(discLabel.trim(), `-${formatRs(bill.discountAmount)}`);
  }
  drawSummaryRow(
    isUrdu ? 'مجموعی بل' : 'Grand Total',
    formatRs(bill.grandTotal),
    true,
    true
  );

  if (bill.docType === 'Bill') {
    drawSummaryRow(
      isUrdu ? 'وصول شدہ رقم' : 'Received (Wasool)',
      formatRs(bill.receivedAmount)
    );
    drawSummaryRow(
      isUrdu ? 'بقایا رقم' : 'Remaining (Baqaya)',
      formatRs(bill.remainingBalance),
      true,
      true
    );
    if (previousBaqaya > 0) {
      drawSummaryRow(
        isUrdu ? 'کل کھاتہ بقایا' : 'Total Khata Baqaya',
        formatRs(previousBaqaya),
        false,
        false,
        true
      );
    }
  }

  // --- NOTES ---
  if (noteLines.length > 0) {
    y += 6;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    y += 10;

    ctx.fillStyle = '#475569';
    ctx.font = isUrdu
      ? `500 ${isThermal ? 17 : 20}px ${fontUrdu}`
      : `500 ${isThermal ? 16 : 19}px ${fontSans}`;
    ctx.direction = isUrdu ? 'rtl' : 'ltr';
    ctx.textAlign = isUrdu ? 'right' : 'left';
    for (const line of noteLines) {
      ctx.fillText(line, isUrdu ? width - pad : pad, y);
      y += isThermal ? 24 : 28;
    }
  }

  // --- FOOTER ---
  y += 10;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += 14;

  ctx.textAlign = 'center';
  ctx.direction = isUrdu ? 'rtl' : 'ltr';
  ctx.fillStyle = '#475569';
  ctx.font = isUrdu
    ? `400 ${isThermal ? 16 : 19}px ${fontUrdu}`
    : `400 ${isThermal ? 15 : 18}px ${fontSans}`;
  for (const line of footerLines) {
    ctx.fillText(line, centerX, y);
    y += isThermal ? 22 : 26;
  }

  y += 4;
  ctx.fillStyle = '#0F172A';
  ctx.font = isUrdu
    ? `700 ${isThermal ? 17 : 20}px ${fontUrdu}`
    : `700 ${isThermal ? 16 : 19}px ${fontSans}`;
  ctx.fillText(
    isUrdu
      ? `${URDU_STORE_INFO.storeName} · عمرزئی، چارسدہ`
      : `${settings.storeName} · Umarzai, Charsadda`,
    centerX,
    y
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not generate slip PNG'))),
      'image/png'
    );
  });

  const safeBillNo = bill.billNo.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${safeBillNo || 'Hafiz-Slip'}-${lang}.png`;
  return { blob, fileName };
}
