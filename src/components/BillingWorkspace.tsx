import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Hammer,
  MessageCircle,
  Minus,
  Paintbrush,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Scale,
  ScanLine,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { HARDWARE_QUICK_ITEMS, KILO_QUICK_ITEMS } from '../data/colours';
import {
  BillItem,
  BillRecord,
  CustomerRecord,
  DiscountType,
  DocType,
  MANUAL_UNITS,
  PACK_SIZES,
  PackSize,
  PaintColour,
  PaymentStatus,
  RateMemoryMap,
  StoreSettings,
} from '../types/khata';
import {
  buildWhatsAppBillText,
  CustomerLedgerSummary,
  formatRs,
  lookupSavedManualRate,
  lookupSavedPaintRate,
  normalizePhoneForWhatsApp,
  todayISO,
} from '../utils/storage';

interface BillingWorkspaceProps {
  colours: PaintColour[];
  rateMemory: RateMemoryMap;
  customerSummaries: CustomerLedgerSummary[];
  settings: StoreSettings;
  editingBill: BillRecord | null;
  nextBillNo: string;
  items: BillItem[];
  setItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  onOpenScanner: () => void;
  onAddPaintItem: (colour: PaintColour, packSize: PackSize, qty: number, rate: number) => void;
  onAddManualItem: (name: string, unitLabel: string, qty: number, rate: number) => void;
  onCreateCustomColour: (code: string, name: string) => PaintColour;
  onSaveBill: (
    draft: Omit<BillRecord, 'id' | 'createdAt' | 'updatedAt' | 'customerId'> & {
      existingCustomerId?: string;
    },
    openPrintSlip: boolean
  ) => BillRecord;
  onCancelEdit: () => void;
}

export const BillingWorkspace: React.FC<BillingWorkspaceProps> = ({
  colours,
  rateMemory,
  customerSummaries,
  settings,
  editingBill,
  nextBillNo,
  items,
  setItems,
  onOpenScanner,
  onAddPaintItem,
  onAddManualItem,
  onCreateCustomColour,
  onSaveBill,
  onCancelEdit,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Entry Mode: Paint Colour vs Manual Hardware
  const [entryMode, setEntryMode] = useState<'paint' | 'manual'>('paint');

  // Paint Selector State
  const [colourQuery, setColourQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedColour, setSelectedColour] = useState<PaintColour | null>(colours[0] ?? null);
  const [packSize, setPackSize] = useState<PackSize>('Gallon');
  const [paintQty, setPaintQty] = useState<number>(1);
  const [paintRate, setPaintRate] = useState<string>('');
  const [rateHint, setRateHint] = useState<'exact' | 'pack' | null>(null);

  // Inline Custom Colour Creator
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');

  // Manual Hardware Item State
  const [manualName, setManualName] = useState('');
  const [manualUnit, setManualUnit] = useState('Piece');
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualRate, setManualRate] = useState<string>('');

  // Bill / Customer Details State
  const [docType, setDocType] = useState<DocType>('Bill');
  const [billNo, setBillNo] = useState(nextBillNo);
  const [date, setDate] = useState(todayISO());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('Rs');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [notes, setNotes] = useState('');

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // Populate when loading an existing bill for editing
  useEffect(() => {
    if (editingBill) {
      setDocType(editingBill.docType);
      setBillNo(editingBill.billNo);
      setDate(editingBill.date);
      setSelectedCustomerId(editingBill.customerId);
      setCustomerName(editingBill.customerName);
      setCustomerPhone(editingBill.customerPhone);
      setItems(editingBill.items);
      setDiscountType(editingBill.discountType);
      setDiscountValue(editingBill.discountValue);
      setPaymentStatus(editingBill.paymentStatus);
      setReceivedAmount(editingBill.receivedAmount);
      setReceivedTouched(Boolean(editingBill.id));
      setNotes(editingBill.notes);
    } else {
      setBillNo(nextBillNo);
    }
  }, [editingBill, nextBillNo, setItems]);

  // Auto-lookup Paint Rate whenever colour or packSize changes
  useEffect(() => {
    if (!selectedColour) return;
    const { rate, source } = lookupSavedPaintRate(
      rateMemory,
      selectedColour.code,
      selectedColour.name,
      packSize
    );
    if (rate !== null) {
      setPaintRate(String(rate));
      setRateHint(source);
    } else {
      setPaintRate('');
      setRateHint(null);
    }
  }, [selectedColour, packSize, rateMemory]);

  // Auto-lookup Manual Item Rate whenever manualName or manualUnit changes
  useEffect(() => {
    if (!manualName.trim()) return;
    const saved = lookupSavedManualRate(rateMemory, manualName, manualUnit);
    if (saved !== null) {
      setManualRate(String(saved));
    }
  }, [manualName, manualUnit, rateMemory]);

  // Instant search filtering across 300+ colours
  const filteredColours = useMemo(() => {
    const q = colourQuery.trim().toLowerCase();
    if (!q) return colours.slice(0, 60);
    const exactCode: PaintColour[] = [];
    const startsCode: PaintColour[] = [];
    const contains: PaintColour[] = [];

    for (const c of colours) {
      const codeL = c.code.toLowerCase();
      const nameL = c.name.toLowerCase();
      if (codeL === q) {
        exactCode.push(c);
      } else if (codeL.startsWith(q)) {
        startsCode.push(c);
      } else if (codeL.includes(q) || nameL.includes(q)) {
        contains.push(c);
      }
    }
    return [...exactCode, ...startsCode, ...contains].slice(0, 80);
  }, [colours, colourQuery]);

  // Customer autocomplete filtering
  const matchingCustomers = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return customerSummaries.slice(0, 8);
    return customerSummaries
      .filter(
        (s) =>
          s.customer.name.toLowerCase().includes(q) ||
          s.customer.phone.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customerSummaries, customerName]);

  const activeCustomerSummary = useMemo(() => {
    if (selectedCustomerId) {
      return customerSummaries.find((s) => s.customer.id === selectedCustomerId) ?? null;
    }
    if (customerName.trim()) {
      return (
        customerSummaries.find(
          (s) =>
            s.customer.name.trim().toLowerCase() === customerName.trim().toLowerCase()
        ) ?? null
      );
    }
    return null;
  }, [customerSummaries, selectedCustomerId, customerName]);

  // Totals math
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.total, 0),
    [items]
  );

  const discountAmount = useMemo(() => {
    if (discountValue <= 0) return 0;
    if (discountType === '%') {
      return Math.min(subtotal, Math.round((subtotal * discountValue) / 100));
    }
    return Math.min(subtotal, Math.round(discountValue));
  }, [subtotal, discountType, discountValue]);

  const grandTotal = Math.max(0, subtotal - discountAmount);

  // Keep receivedAmount synced cleanly with paymentStatus unless user overrides Partial manually
  useEffect(() => {
    if (paymentStatus === 'Paid') {
      setReceivedAmount(grandTotal);
    } else if (paymentStatus === 'Udhaar') {
      setReceivedAmount(0);
    } else if (!receivedTouched && receivedAmount > grandTotal) {
      setReceivedAmount(grandTotal);
    }
  }, [grandTotal, paymentStatus, receivedTouched]);

  const effectiveReceived =
    docType === 'Quotation' ? 0 : Math.min(grandTotal, Math.max(0, receivedAmount));
  const remainingBalance = Math.max(0, grandTotal - effectiveReceived);

  const handleSelectColour = (c: PaintColour) => {
    setSelectedColour(c);
    setColourQuery(`${c.code} ${c.name}`);
    setDropdownOpen(false);
  };

  const handleAddSelectedColour = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedColour) return;
    const numericRate = Math.max(0, Number(paintRate) || 0);
    const numericQty = Math.max(0.25, Number(paintQty) || 1);
    onAddPaintItem(selectedColour, packSize, numericQty, numericRate);
    showToast(`Added ${selectedColour.code} ${selectedColour.name} (${packSize})`);
    setPaintQty(1);
    setColourQuery('');
    searchInputRef.current?.focus();
  };

  const handleCreateCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim() || !customName.trim()) return;
    const created = onCreateCustomColour(customCode.trim(), customName.trim());
    setSelectedColour(created);
    setColourQuery(`${created.code} ${created.name}`);
    setCustomCode('');
    setCustomName('');
    setShowCustomForm(false);
    showToast(`Saved custom colour ${created.code} ${created.name}`);
  };

  const handleAddManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    const numericRate = Math.max(0, Number(manualRate) || 0);
    const numericQty = Math.max(0.25, Number(manualQty) || 1);
    onAddManualItem(manualName.trim(), manualUnit.trim() || 'Piece', numericQty, numericRate);
    showToast(`Added ${manualName.trim()} (${manualUnit})`);
    setManualName('');
    setManualQty(1);
    setManualRate('');
  };

  const handleUpdateItemQty = (id: string, qty: number) => {
    const safeQty = Math.max(0, qty);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: safeQty, total: safeQty * item.rate } : item
      )
    );
  };

  const handleUpdateItemRate = (id: string, rate: number) => {
    const safeRate = Math.max(0, rate);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, rate: safeRate, total: item.qty * safeRate } : item
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePickCustomer = (c: CustomerRecord) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerDropdownOpen(false);
  };

  const buildDraftPayload = () => ({
    billNo,
    docType,
    date,
    existingCustomerId: selectedCustomerId || undefined,
    customerName: customerName.trim() || 'Walk-in Customer',
    customerPhone: customerPhone.trim(),
    items,
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    grandTotal,
    receivedAmount: effectiveReceived,
    remainingBalance: docType === 'Quotation' ? 0 : remainingBalance,
    paymentStatus: docType === 'Quotation' ? ('Paid' as PaymentStatus) : paymentStatus,
    notes: notes.trim(),
  });

  const handleSaveAction = (openPrint: boolean) => {
    if (items.length === 0) {
      showToast('Add at least one colour or hardware item first');
      return;
    }
    const saved = onSaveBill(buildDraftPayload(), openPrint);
    if (!openPrint) {
      showToast(`${saved.docType} ${saved.billNo} saved to Khata`);
    }
  };

  const handleResetBill = () => {
    setItems([]);
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setDiscountValue(0);
    setPaymentStatus('Paid');
    setReceivedAmount(0);
    setReceivedTouched(false);
    setNotes('');
    setDate(todayISO());
    onCancelEdit();
  };

  const handleCopyWhatsApp = async () => {
    if (items.length === 0) {
      showToast('Add items to share receipt');
      return;
    }
    const tempBill: BillRecord = {
      id: 'preview',
      customerId: selectedCustomerId || 'walkin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...buildDraftPayload(),
    };
    const text = buildWhatsAppBillText(
      tempBill,
      settings,
      activeCustomerSummary?.baqaya ?? 0
    );
    try {
      await navigator.clipboard.writeText(text);
      showToast('Receipt formatted & copied for WhatsApp');
    } catch {
      showToast('Use Print / Slip button to share on WhatsApp');
    }
  };

  const waPhone = normalizePhoneForWhatsApp(customerPhone);
  const waDirectLink = useMemo(() => {
    if (items.length === 0) return null;
    const tempBill: BillRecord = {
      id: 'preview',
      customerId: selectedCustomerId || 'walkin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...buildDraftPayload(),
    };
    const text = buildWhatsAppBillText(
      tempBill,
      settings,
      activeCustomerSummary?.baqaya ?? 0
    );
    return waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [items, customerName, customerPhone, discountAmount, effectiveReceived, paymentStatus, docType, billNo, date, notes, settings, waPhone, activeCustomerSummary]);

  const paintLineTotal = (Number(paintQty) || 0) * (Number(paintRate) || 0);
  const manualLineTotal = (Number(manualQty) || 0) * (Number(manualRate) || 0);

  return (
    <div className="space-y-5">
      {/* Feedback Toast */}
      {toast && (
        <div
          className="fixed bottom-20 lg:bottom-6 right-4 z-40 px-4 py-2.5 rounded-lg border shadow-lg text-sm font-medium flex items-center gap-2"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--accent)',
            color: 'var(--text-primary)',
          }}
        >
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Editing Banner */}
      {editingBill && editingBill.id && (
        <div
          className="px-4 py-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-sm"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
          }}
        >
          <span>
            Editing saved {editingBill.docType}{' '}
            <strong className="font-mono-num">{editingBill.billNo}</strong>
          </span>
          <button
            type="button"
            onClick={handleResetBill}
            className="text-xs font-semibold underline cursor-pointer"
            style={{ color: 'var(--accent-text)' }}
          >
            Cancel Edit &amp; Start New
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT / MAIN COLUMN: Item Entry + Bill Table */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Mode Switch + Scanner Trigger */}
          <section
            className="rounded-xl border p-4 sm:p-5 space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Segmented Entry Tabs */}
              <div
                className="inline-flex p-1 rounded-lg border"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEntryMode('paint')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: entryMode === 'paint' ? 'var(--bg-surface)' : 'transparent',
                    color: entryMode === 'paint' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: entryMode === 'paint' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span>Paint Colours</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: entryMode === 'manual' ? 'var(--bg-surface)' : 'transparent',
                    color: entryMode === 'manual' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: entryMode === 'manual' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  <Hammer className="w-4 h-4" />
                  <span>Manual / Kilo Items</span>
                </button>
              </div>

              {/* Direct Colour Scanner Button */}
              <button
                type="button"
                onClick={onOpenScanner}
                className="min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <ScanLine className="w-4 h-4" />
                <span>Scan Colour Code</span>
              </button>
            </div>

            {entryMode === 'paint' ? (
              <form onSubmit={handleAddSelectedColour} className="space-y-4">
                {/* Instant Colour Search Input */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="colour-search"
                      className="text-xs font-medium"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Search Shade Number or Name ({colours.length} shades loaded)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCustomForm((v) => !v)}
                      className="text-xs font-semibold hover:underline cursor-pointer"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      {showCustomForm ? 'Close Custom Form' : '+ Add Custom Colour'}
                    </button>
                  </div>

                  <div className="relative">
                    <Search
                      className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <input
                      ref={searchInputRef}
                      id="colour-search"
                      type="text"
                      value={colourQuery}
                      onFocus={() => setDropdownOpen(true)}
                      onChange={(e) => {
                        setColourQuery(e.target.value);
                        setDropdownOpen(true);
                      }}
                      placeholder="Type code e.g. 413, M211, 1708, 8001 or Golden Brown..."
                      className="w-full min-h-[46px] pl-10 pr-20 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    {colourQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setColourQuery('');
                          setDropdownOpen(true);
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Instant Dropdown Results */}
                  {dropdownOpen && (
                    <div
                      className="mt-1.5 rounded-lg border shadow-lg max-h-64 overflow-y-auto divide-y"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      {filteredColours.length > 0 ? (
                        filteredColours.map((c) => {
                          const isSelected = selectedColour?.id === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleSelectColour(c)}
                              className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 hover:opacity-90 transition-colors cursor-pointer"
                              style={{
                                backgroundColor: isSelected ? 'var(--accent-soft)' : 'transparent',
                                borderColor: 'var(--border-subtle)',
                              }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="w-6 h-6 rounded border shrink-0"
                                  style={{
                                    backgroundColor: c.hex,
                                    borderColor: 'var(--border-strong)',
                                  }}
                                />
                                <div className="min-w-0">
                                  <span className="font-mono-num font-semibold text-sm mr-2">
                                    {c.code}
                                  </span>
                                  <span className="text-sm font-medium">{c.name}</span>
                                </div>
                              </div>
                              <span
                                className="text-xs shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {c.series}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                          No colour matched "{colourQuery}". Use "+ Add Custom Colour" above.
                        </div>
                      )}
                      <div
                        className="px-3 py-2 text-right sticky bottom-0 border-t"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setDropdownOpen(false)}
                          className="text-xs font-medium cursor-pointer"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inline Add Custom Colour Form */}
                {showCustomForm && (
                  <div
                    className="p-3.5 rounded-lg border space-y-3"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      borderColor: 'var(--border-strong)',
                    }}
                  >
                    <div className="text-xs font-semibold">Add New Custom Colour Code</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value)}
                        placeholder="Code (e.g. 905)"
                        className="min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-strong)',
                        }}
                      />
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Shade Name (e.g. Pearl Ivory)"
                        className="min-h-[42px] px-3 py-2 rounded-lg border text-sm sm:col-span-2"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-strong)',
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCustomForm(false)}
                        className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateCustomSubmit}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        Save Custom Colour
                      </button>
                    </div>
                  </div>
                )}

                {/* Selected Colour Summary Bar */}
                {selectedColour && (
                  <div
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-8 h-8 rounded-md border shrink-0"
                        style={{
                          backgroundColor: selectedColour.hex,
                          borderColor: 'var(--border-strong)',
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          <span className="font-mono-num mr-1.5">{selectedColour.code}</span>
                          <span>{selectedColour.name}</span>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Series: {selectedColour.series}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium shrink-0" style={{ color: 'var(--accent-text)' }}>
                      Selected
                    </span>
                  </div>
                )}

                {/* Pack Size Selector: Quarter, Liter, Gallon, Pond, Bucket, Drum, Kg */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Pack Size / Weight
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {PACK_SIZES.map((pack) => {
                      const active = packSize === pack;
                      return (
                        <button
                          key={pack}
                          type="button"
                          onClick={() => setPackSize(pack)}
                          className="min-h-[44px] px-2 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap"
                          style={{
                            backgroundColor: active ? 'var(--accent)' : 'var(--bg-subtle)',
                            borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                            color: active ? '#ffffff' : 'var(--text-primary)',
                          }}
                        >
                          {pack}
                        </button>
                      );
                    })}
                  </div>
                  {packSize === 'Kg' && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--text-muted)' }}>
                        Quick Kg:
                      </span>
                      {[
                        { val: 0.25, label: '0.25 Kg (Pao)' },
                        { val: 0.5, label: '0.5 Kg (Half)' },
                        { val: 1, label: '1 Kg' },
                        { val: 2, label: '2 Kg' },
                        { val: 5, label: '5 Kg' },
                        { val: 10, label: '10 Kg' },
                      ].map((w) => (
                        <button
                          key={w.val}
                          type="button"
                          onClick={() => setPaintQty(w.val)}
                          className="min-h-[32px] px-2.5 py-1 rounded-md border text-xs font-mono-num cursor-pointer"
                          style={{
                            backgroundColor: paintQty === w.val ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                            borderColor: paintQty === w.val ? 'var(--accent)' : 'var(--border-subtle)',
                            color: paintQty === w.val ? 'var(--accent-text)' : 'var(--text-secondary)',
                          }}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity, Rate, Line Total & Add Button */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Quantity
                    </label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setPaintQty((q) => Math.max(0.5, q - 1))}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-l-lg border border-r-0 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderColor: 'var(--border-strong)',
                        }}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="0.25"
                        step="any"
                        value={paintQty}
                        onChange={(e) => setPaintQty(Math.max(0, Number(e.target.value)))}
                        className="w-full min-h-[44px] px-2 py-2 border text-center text-sm font-mono-num focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-canvas)',
                          borderColor: 'var(--border-strong)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setPaintQty((q) => q + 1)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-r-lg border border-l-0 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderColor: 'var(--border-strong)',
                        }}
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className="text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Rate (Rs.)
                      </label>
                      {rateHint && (
                        <span className="text-[11px]" style={{ color: 'var(--accent-text)' }}>
                          {rateHint === 'exact' ? 'Saved shade rate' : 'Saved pack rate'}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={paintRate}
                      onChange={(e) => setPaintRate(e.target.value)}
                      placeholder="Enter rate"
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg border text-sm font-mono-num focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <button
                      type="submit"
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-95"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add · {formatRs(paintLineTotal)}</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* SEPARATE MANUAL HARDWARE & KILO ITEMS FORM */
              <form onSubmit={handleAddManualSubmit} className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Scale className="w-3.5 h-3.5" style={{ color: 'var(--accent-text)' }} />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Kilo / Weight Items (Per Kg)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {KILO_QUICK_ITEMS.map((kw) => (
                        <button
                          key={kw.name}
                          type="button"
                          onClick={() => {
                            setManualName(kw.name);
                            setManualUnit(kw.defaultUnit);
                          }}
                          className="min-h-[36px] px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors"
                          style={{
                            backgroundColor:
                              manualName === kw.name ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                            borderColor:
                              manualName === kw.name ? 'var(--accent)' : 'var(--border-subtle)',
                            color:
                              manualName === kw.name ? 'var(--accent-text)' : 'var(--text-primary)',
                          }}
                        >
                          {kw.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span
                      className="block text-xs font-medium mb-2"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Tools &amp; Hardware Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {HARDWARE_QUICK_ITEMS.map((hw) => (
                        <button
                          key={hw.name}
                          type="button"
                          onClick={() => {
                            setManualName(hw.name);
                            setManualUnit(hw.defaultUnit);
                          }}
                          className="min-h-[36px] px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer transition-colors"
                          style={{
                            backgroundColor:
                              manualName === hw.name ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                            borderColor:
                              manualName === hw.name ? 'var(--accent)' : 'var(--border-subtle)',
                            color:
                              manualName === hw.name ? 'var(--accent-text)' : 'var(--text-primary)',
                          }}
                        >
                          {hw.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Manual / Kilo Item Name
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Wall Putty, White Cement, Brush 4&quot;..."
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Unit / Weight
                    </label>
                    <select
                      value={manualUnit}
                      onChange={(e) => setManualUnit(e.target.value)}
                      className="w-full min-h-[44px] px-2.5 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      {MANUAL_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {manualUnit === 'Kg' ? 'Weight (Kg)' : 'Qty'}
                    </label>
                    <input
                      type="number"
                      min="0.05"
                      step="any"
                      value={manualQty}
                      onChange={(e) => setManualQty(Math.max(0, Number(e.target.value)))}
                      className="w-full min-h-[44px] px-2.5 py-2 rounded-lg border text-sm font-mono-num"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {manualUnit === 'Kg' ? 'Rate / Kg' : 'Rate'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={manualRate}
                      onChange={(e) => setManualRate(e.target.value)}
                      placeholder="Rs."
                      className="w-full min-h-[44px] px-2.5 py-2 rounded-lg border text-sm font-mono-num"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                  </div>
                </div>

                {manualUnit === 'Kg' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--text-muted)' }}>
                      Quick Weight:
                    </span>
                    {[
                      { val: 0.25, label: '0.25 Kg (Pao)' },
                      { val: 0.5, label: '0.5 Kg (Half)' },
                      { val: 1, label: '1 Kg' },
                      { val: 2, label: '2 Kg' },
                      { val: 5, label: '5 Kg' },
                      { val: 10, label: '10 Kg' },
                      { val: 20, label: '20 Kg' },
                      { val: 40, label: '40 Kg (Man)' },
                    ].map((w) => (
                      <button
                        key={w.val}
                        type="button"
                        onClick={() => setManualQty(w.val)}
                        className="min-h-[34px] px-2.5 py-1 rounded-md border text-xs font-mono-num cursor-pointer"
                        style={{
                          backgroundColor: manualQty === w.val ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                          borderColor: manualQty === w.val ? 'var(--accent)' : 'var(--border-subtle)',
                          color: manualQty === w.val ? 'var(--accent-text)' : 'var(--text-secondary)',
                        }}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2 cursor-pointer"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Manual Item · {formatRs(manualLineTotal)}</span>
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Active Bill Items Table */}
          <section
            className="rounded-xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div
              className="px-4 sm:px-5 py-3.5 border-b flex items-center justify-between gap-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                <h2 className="text-sm sm:text-base font-semibold">
                  Current {docType} Items ({items.length})
                </h2>
              </div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="text-xs font-medium hover:underline cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Clear Items
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium">No items added to this bill yet</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Search a paint code above, scan a tin label, or switch to Manual Hardware &amp; Other.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr
                      className="border-b text-xs font-medium"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <th className="py-2.5 px-3 sm:px-4">Item / Shade</th>
                      <th className="py-2.5 px-2">Pack / Unit</th>
                      <th className="py-2.5 px-2 text-right">Qty</th>
                      <th className="py-2.5 px-2 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {items.map((item) => (
                      <tr key={item.id} className="text-sm">
                        <td className="py-2.5 px-3 sm:px-4">
                          <div className="flex items-center gap-2.5">
                            {item.swatchHex ? (
                              <span
                                className="w-4 h-4 rounded-xs border shrink-0"
                                style={{
                                  backgroundColor: item.swatchHex,
                                  borderColor: 'var(--border-strong)',
                                }}
                              />
                            ) : (
                              <Hammer
                                className="w-4 h-4 shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                              />
                            )}
                            <div>
                              <div className="font-medium leading-snug">
                                {item.code && (
                                  <span className="font-mono-num font-semibold mr-1.5">
                                    {item.code}
                                  </span>
                                )}
                                <span>{item.name}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="py-2.5 px-2 text-xs whitespace-nowrap"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {item.unitLabel}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            min="0.25"
                            step="any"
                            value={item.qty}
                            onChange={(e) =>
                              handleUpdateItemQty(item.id, Number(e.target.value))
                            }
                            className="w-16 min-h-[36px] px-1.5 py-1 rounded border text-right text-xs font-mono-num"
                            style={{
                              backgroundColor: 'var(--bg-canvas)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={(e) =>
                              handleUpdateItemRate(item.id, Number(e.target.value))
                            }
                            className="w-20 min-h-[36px] px-1.5 py-1 rounded border text-right text-xs font-mono-num"
                            style={{
                              backgroundColor: 'var(--bg-canvas)',
                              borderColor: 'var(--border-subtle)',
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-semibold whitespace-nowrap">
                          {Math.round(item.total).toLocaleString('en-PK')}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-red-600 hover:bg-red-500/10 cursor-pointer"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Customer Info, Khata Status & Totals */}
        <aside className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-20">
          <section
            className="rounded-xl border p-4 sm:p-5 space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {/* Doc Type + Bill No + Date */}
            <div className="flex items-center justify-between gap-2">
              <div
                className="inline-flex p-1 rounded-lg border"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                {(['Bill', 'Quotation'] as DocType[]).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setDocType(dt)}
                    className="min-h-[36px] px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
                    style={{
                      backgroundColor: docType === dt ? 'var(--bg-surface)' : 'transparent',
                      color: docType === dt ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {dt}
                  </button>
                ))}
              </div>
              <span className="font-mono-num text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                #{billNo}
              </span>
            </div>

            {/* Customer Name (with Khata Autocomplete) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Customer Name
                </label>
                {activeCustomerSummary && activeCustomerSummary.baqaya > 0 && (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 font-mono-num">
                    Prev. Baqaya: {formatRs(activeCustomerSummary.baqaya)}
                  </span>
                )}
              </div>
              <div className="relative">
                <UserPlus
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={customerName}
                  onFocus={() => {
                    if (customerSummaries.length > 0) setCustomerDropdownOpen(true);
                  }}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 160)}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setSelectedCustomerId('');
                    setCustomerDropdownOpen(true);
                  }}
                  placeholder="Enter customer or select from Khata..."
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-strong)',
                  }}
                />
              </div>

              {customerDropdownOpen && matchingCustomers.length > 0 && (
                <div
                  className="absolute left-0 right-0 mt-1 z-20 rounded-lg border shadow-lg max-h-48 overflow-y-auto divide-y"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                  }}
                >
                  {matchingCustomers.map((s) => (
                    <button
                      key={s.customer.id}
                      type="button"
                      onMouseDown={() => handlePickCustomer(s.customer)}
                      className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs hover:opacity-90 cursor-pointer"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <div>
                        <div className="font-semibold text-sm">{s.customer.name}</div>
                        <div className="font-mono-num" style={{ color: 'var(--text-muted)' }}>
                          {s.customer.phone || 'No phone'}
                        </div>
                      </div>
                      {s.baqaya > 0 && (
                        <span className="font-mono-num font-semibold text-amber-600 dark:text-amber-400">
                          {formatRs(s.baqaya)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Phone (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-strong)',
                  }}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-strong)',
                  }}
                />
              </div>
            </div>

            {/* Financial Summary & Discount */}
            <div
              className="pt-3 border-t space-y-2.5 text-sm"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span className="font-mono-num font-semibold">{formatRs(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="inline-flex rounded-md border overflow-hidden"
                    style={{ borderColor: 'var(--border-strong)' }}
                  >
                    {(['Rs', '%'] as DiscountType[]).map((dt) => (
                      <button
                        key={dt}
                        type="button"
                        onClick={() => setDiscountType(dt)}
                        className="px-2 py-1 text-xs font-medium cursor-pointer"
                        style={{
                          backgroundColor:
                            discountType === dt ? 'var(--accent)' : 'var(--bg-subtle)',
                          color: discountType === dt ? '#ffffff' : 'var(--text-secondary)',
                        }}
                      >
                        {dt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="w-24 min-h-[36px] px-2 py-1 rounded-md border text-right text-sm font-mono-num"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-strong)',
                    }}
                  />
                </div>
              </div>

              <div
                className="flex justify-between items-baseline pt-2 border-t text-base font-bold"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span>Grand Total</span>
                <span className="font-mono-num text-lg">{formatRs(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Status & Received / Baqaya */}
            {docType === 'Bill' && (
              <div
                className="pt-3 border-t space-y-3"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Payment Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Paid', 'Udhaar', 'Partial'] as PaymentStatus[]).map((st) => {
                      const active = paymentStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setPaymentStatus(st);
                            setReceivedTouched(false);
                            if (st === 'Paid') setReceivedAmount(grandTotal);
                            if (st === 'Udhaar') setReceivedAmount(0);
                          }}
                          className="min-h-[40px] px-2 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors"
                          style={{
                            backgroundColor: active ? 'var(--accent)' : 'var(--bg-subtle)',
                            borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                            color: active ? '#ffffff' : 'var(--text-primary)',
                          }}
                        >
                          {st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="block text-xs font-medium mb-1"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Received (Wasool)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      step="any"
                      value={effectiveReceived || ''}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setReceivedTouched(true);
                        setReceivedAmount(val);
                        if (val >= grandTotal && grandTotal > 0) {
                          setPaymentStatus('Paid');
                        } else if (val === 0) {
                          setPaymentStatus('Udhaar');
                        } else {
                          setPaymentStatus('Partial');
                        }
                      }}
                      placeholder="0"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-medium mb-1"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Remaining (Baqaya)
                    </label>
                    <div
                      className={`min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num font-bold flex items-center justify-end ${
                        remainingBalance > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      {formatRs(remainingBalance)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note (e.g. Painter name, site address)"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border text-xs"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-subtle)',
                }}
              />
            </div>

            {/* Primary Save & Share Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleSaveAction(true)}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-95"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Printer className="w-4 h-4" />
                <span>{editingBill && editingBill.id ? 'Update & Print Slip' : 'Save & Print Slip'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveAction(false)}
                  className="min-h-[42px] px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border-strong)',
                  }}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingBill && editingBill.id ? 'Update Bill' : 'Save to Khata'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetBill}
                  className="min-h-[42px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Bill</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="min-h-[40px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Receipt</span>
                </button>

                {waDirectLink ? (
                  <a
                    href={waDirectLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600/40 text-white flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
