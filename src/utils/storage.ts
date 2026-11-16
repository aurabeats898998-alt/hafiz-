import { DEFAULT_COLOURS } from '../data/colours';
import {
  BillRecord,
  CustomerRecord,
  PaintColour,
  RateMemoryMap,
  StoreSettings,
} from '../types/khata';

const KEYS = {
  SETTINGS: 'hafiz_settings_v1',
  CUSTOM_COLOURS: 'hafiz_custom_colours_v1',
  EDITED_COLOURS: 'hafiz_edited_colours_v1',
  DELETED_COLOUR_IDS: 'hafiz_deleted_colour_ids_v1',
  RATE_MEMORY: 'hafiz_rate_memory_v1',
  BILLS: 'hafiz_bills_v1',
  CUSTOMERS: 'hafiz_customers_v1',
  NEXT_BILL_NO: 'hafiz_next_bill_num_v1',
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Al Hafiz Paints Store',
  appName: 'Hafiz',
  address: 'Umarzai Bazar, Near Allied Bank, Umarzai, Charsadda',
  phone1: '03029140071',
  phone2: '03169370386',
  email: '',
  footerNote: 'Thank you for your business. Sealed tins exchangeable within 7 days.',
  printFormat: 'a4',
  theme: 'daylight',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function loadSettings(): StoreSettings {
  const saved = safeRead<Partial<StoreSettings>>(KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(settings: StoreSettings): void {
  safeWrite(KEYS.SETTINGS, settings);
}

export function loadColours(): PaintColour[] {
  const custom = safeRead<PaintColour[]>(KEYS.CUSTOM_COLOURS, []);
  const edited = safeRead<Record<string, PaintColour>>(KEYS.EDITED_COLOURS, {});
  const deleted = new Set(safeRead<string[]>(KEYS.DELETED_COLOUR_IDS, []));

  const mergedBase = DEFAULT_COLOURS.filter((c) => !deleted.has(c.id)).map(
    (c) => edited[c.id] ?? c
  );

  const customProcessed = custom.filter((c) => !deleted.has(c.id));
  return [...customProcessed, ...mergedBase];
}

export function saveCustomOrEditedColour(colour: PaintColour): PaintColour[] {
  if (colour.isCustom) {
    const custom = safeRead<PaintColour[]>(KEYS.CUSTOM_COLOURS, []);
    const idx = custom.findIndex((c) => c.id === colour.id);
    const updated =
      idx >= 0
        ? custom.map((c) => (c.id === colour.id ? colour : c))
        : [colour, ...custom];
    safeWrite(KEYS.CUSTOM_COLOURS, updated);
  } else {
    const edited = safeRead<Record<string, PaintColour>>(KEYS.EDITED_COLOURS, {});
    edited[colour.id] = colour;
    safeWrite(KEYS.EDITED_COLOURS, edited);
  }
  return loadColours();
}

export function deleteColourById(id: string): PaintColour[] {
  const deleted = safeRead<string[]>(KEYS.DELETED_COLOUR_IDS, []);
  if (!deleted.includes(id)) {
    deleted.push(id);
    safeWrite(KEYS.DELETED_COLOUR_IDS, deleted);
  }
  return loadColours();
}

export function resetColoursToDefault(): PaintColour[] {
  localStorage.removeItem(KEYS.CUSTOM_COLOURS);
  localStorage.removeItem(KEYS.EDITED_COLOURS);
  localStorage.removeItem(KEYS.DELETED_COLOUR_IDS);
  return loadColours();
}

export function loadRateMemory(): RateMemoryMap {
  return safeRead<RateMemoryMap>(KEYS.RATE_MEMORY, {});
}

export function saveRateMemory(map: RateMemoryMap): void {
  safeWrite(KEYS.RATE_MEMORY, map);
}

export function getPaintRateKey(code: string, name: string, packSize: string): string {
  return `paint:${code.trim().toLowerCase()}__${name.trim().toLowerCase()}__${packSize}`;
}

export function getPackFallbackKey(packSize: string): string {
  return `pack:${packSize}`;
}

export function getManualRateKey(name: string, unitLabel: string): string {
  return `manual:${name.trim().toLowerCase()}__${unitLabel.trim().toLowerCase()}`;
}

export function lookupSavedPaintRate(
  memory: RateMemoryMap,
  code: string,
  name: string,
  packSize: string
): { rate: number | null; source: 'exact' | 'pack' | null } {
  const exactKey = getPaintRateKey(code, name, packSize);
  if (typeof memory[exactKey] === 'number' && memory[exactKey] > 0) {
    return { rate: memory[exactKey], source: 'exact' };
  }
  const packKey = getPackFallbackKey(packSize);
  if (typeof memory[packKey] === 'number' && memory[packKey] > 0) {
    return { rate: memory[packKey], source: 'pack' };
  }
  return { rate: null, source: null };
}

export function lookupSavedManualRate(
  memory: RateMemoryMap,
  name: string,
  unitLabel: string
): number | null {
  const exact = getManualRateKey(name, unitLabel);
  if (typeof memory[exact] === 'number' && memory[exact] > 0) {
    return memory[exact];
  }
  return null;
}

export function loadBills(): BillRecord[] {
  return safeRead<BillRecord[]>(KEYS.BILLS, []);
}

export function saveBills(bills: BillRecord[]): void {
  safeWrite(KEYS.BILLS, bills);
}

export function loadCustomers(): CustomerRecord[] {
  return safeRead<CustomerRecord[]>(KEYS.CUSTOMERS, []);
}

export function saveCustomers(customers: CustomerRecord[]): void {
  safeWrite(KEYS.CUSTOMERS, customers);
}

export function peekNextBillNo(): string {
  const num = safeRead<number>(KEYS.NEXT_BILL_NO, 1001);
  return `HFZ-${num}`;
}

export function incrementNextBillNo(): string {
  const current = safeRead<number>(KEYS.NEXT_BILL_NO, 1001);
  safeWrite(KEYS.NEXT_BILL_NO, current + 1);
  return `HFZ-${current + 1}`;
}

export function formatRs(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `Rs. ${rounded.toLocaleString('en-PK')}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface CustomerLedgerSummary {
  customer: CustomerRecord;
  customerBills: BillRecord[];
  totalBilled: number;
  totalReceivedOnBills: number;
  totalRecoveries: number;
  totalPaid: number;
  baqaya: number;
  lastActivityDate: string;
}

export function computeCustomerSummaries(
  customers: CustomerRecord[],
  bills: BillRecord[]
): CustomerLedgerSummary[] {
  return customers.map((customer) => {
    const customerBills = bills.filter(
      (b) =>
        b.docType === 'Bill' &&
        (b.customerId === customer.id ||
          (b.customerPhone &&
            customer.phone &&
            b.customerPhone.replace(/\D/g, '') === customer.phone.replace(/\D/g, '')) ||
          b.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
    );

    const totalBilled = customerBills.reduce((acc, b) => acc + b.grandTotal, 0);
    const totalReceivedOnBills = customerBills.reduce(
      (acc, b) => acc + b.receivedAmount,
      0
    );
    const totalRecoveries = customer.payments.reduce((acc, p) => acc + p.amount, 0);
    const totalPaid = totalReceivedOnBills + totalRecoveries;
    const baqaya = Math.max(0, totalBilled - totalPaid);

    const dates = [
      ...customerBills.map((b) => b.date),
      ...customer.payments.map((p) => p.date),
    ].sort();
    const lastActivityDate =
      dates.length > 0 ? dates[dates.length - 1] : new Date(customer.createdAt).toISOString().slice(0, 10);

    return {
      customer,
      customerBills,
      totalBilled,
      totalReceivedOnBills,
      totalRecoveries,
      totalPaid,
      baqaya,
      lastActivityDate,
    };
  });
}

export function buildWhatsAppBillText(
  bill: BillRecord,
  settings: StoreSettings,
  previousBaqaya = 0
): string {
  const lines: string[] = [];
  lines.push(`*${settings.storeName}*`);
  lines.push(`${settings.address}`);
  lines.push(`Mob: ${settings.phone1} / ${settings.phone2}`);
  if (settings.email) lines.push(`Email: ${settings.email}`);
  lines.push('--------------------------------');
  lines.push(`${bill.docType === 'Quotation' ? 'QUOTATION' : 'BILL / SLIP'} #: ${bill.billNo}`);
  lines.push(`Date: ${bill.date}`);
  lines.push(`Customer: ${bill.customerName || 'Walk-in Customer'}`);
  if (bill.customerPhone) lines.push(`Phone: ${bill.customerPhone}`);
  lines.push('--------------------------------');

  bill.items.forEach((item, idx) => {
    const codePrefix = item.code ? `[${item.code}] ` : '';
    lines.push(
      `${idx + 1}. ${codePrefix}${item.name} (${item.unitLabel})\n   ${item.qty} × ${item.rate.toLocaleString('en-PK')} = *Rs. ${Math.round(item.total).toLocaleString('en-PK')}*`
    );
  });

  lines.push('--------------------------------');
  lines.push(`Subtotal: Rs. ${Math.round(bill.subtotal).toLocaleString('en-PK')}`);
  if (bill.discountAmount > 0) {
    lines.push(`Discount: -Rs. ${Math.round(bill.discountAmount).toLocaleString('en-PK')}`);
  }
  lines.push(`*Grand Total: Rs. ${Math.round(bill.grandTotal).toLocaleString('en-PK')}*`);

  if (bill.docType === 'Bill') {
    lines.push(`Received: Rs. ${Math.round(bill.receivedAmount).toLocaleString('en-PK')}`);
    lines.push(
      `*Remaining (Baqaya): Rs. ${Math.round(bill.remainingBalance).toLocaleString('en-PK')}*`
    );
    lines.push(`Status: ${bill.paymentStatus}`);
    if (previousBaqaya > 0) {
      lines.push(
        `Prev. Account Baqaya: Rs. ${Math.round(previousBaqaya).toLocaleString('en-PK')}`
      );
    }
  }
  lines.push('--------------------------------');
  lines.push(settings.footerNote);

  return lines.join('\n');
}

export function normalizePhoneForWhatsApp(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('03') && digits.length === 11) {
    return `92${digits.slice(1)}`;
  }
  if (digits.startsWith('92') && digits.length >= 11) {
    return digits;
  }
  return digits.length >= 10 ? digits : null;
}
