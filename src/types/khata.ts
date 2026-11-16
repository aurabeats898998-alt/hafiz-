export type PackSize = 'Quarter' | 'Liter' | 'Gallon' | 'Pond' | 'Bucket' | 'Drum' | 'Kg';

export const PACK_SIZES: PackSize[] = [
  'Quarter',
  'Liter',
  'Gallon',
  'Pond',
  'Bucket',
  'Drum',
  'Kg',
];

export const MANUAL_UNITS: string[] = [
  'Kg',
  'Gram',
  'Piece',
  'Pond',
  'Packet',
  'Gallon',
  'Bucket',
  'Liter',
  'Quarter',
  'Roll',
  'Meter',
  'Dozen',
  'Bag',
  'Man (40 Kg)',
];

export type ThemeId = 'daylight' | 'stone' | 'midnight';

export type PaymentStatus = 'Paid' | 'Udhaar' | 'Partial';

export type DocType = 'Bill' | 'Quotation';

export type DiscountType = 'Rs' | '%';

export type PrintFormat = 'a4' | 'thermal';

export interface PaintColour {
  id: string;
  code: string;
  name: string;
  hex: string;
  series: string;
  isCustom?: boolean;
}

export interface BillItem {
  id: string;
  kind: 'paint' | 'manual';
  code?: string;
  name: string;
  swatchHex?: string;
  unitLabel: string;
  qty: number;
  rate: number;
  total: number;
}

export interface BillRecord {
  id: string;
  billNo: string;
  docType: DocType;
  date: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: BillItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  grandTotal: number;
  receivedAmount: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomerPayment {
  id: string;
  date: string;
  amount: number;
  method: 'Cash' | 'Easypaisa' | 'JazzCash' | 'Bank';
  note: string;
  createdAt: number;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  address?: string;
  payments: CustomerPayment[];
  createdAt: number;
}

export interface StoreSettings {
  storeName: string;
  appName: string;
  address: string;
  phone1: string;
  phone2: string;
  email: string;
  footerNote: string;
  printFormat: PrintFormat;
  theme: ThemeId;
}

export type RateMemoryMap = Record<string, number>;

export type ActiveTab = 'billing' | 'khata' | 'history' | 'colours' | 'settings';
