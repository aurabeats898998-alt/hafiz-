import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  FileText,
  Palette,
  Plus,
  Receipt,
  Settings,
  SwatchBook,
} from 'lucide-react';
import { BillingWorkspace } from './components/BillingWorkspace';
import { BillsHistoryView } from './components/BillsHistoryView';
import { ColorScannerModal } from './components/ColorScannerModal';
import { ColoursCatalogView } from './components/ColoursCatalogView';
import { KhataLedgerView } from './components/KhataLedgerView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { SettingsView } from './components/SettingsView';
import { SlipPreviewModal } from './components/SlipPreviewModal';
import {
  ActiveTab,
  BillItem,
  BillRecord,
  CustomerPayment,
  CustomerRecord,
  PackSize,
  PaintColour,
  PrintFormat,
  RateMemoryMap,
  StoreSettings,
  ThemeId,
} from './types/khata';
import {
  computeCustomerSummaries,
  deleteColourById,
  getManualRateKey,
  getPackFallbackKey,
  getPaintRateKey,
  incrementNextBillNo,
  loadBills,
  loadColours,
  loadCustomers,
  loadRateMemory,
  loadSettings,
  lookupSavedPaintRate,
  peekNextBillNo,
  resetColoursToDefault,
  saveBills,
  saveCustomOrEditedColour,
  saveCustomers,
  saveRateMemory,
  saveSettings,
} from './utils/storage';

const THEME_CYCLE: ThemeId[] = ['daylight', 'stone', 'midnight'];
const THEME_LABELS: Record<ThemeId, string> = {
  daylight: 'Daylight',
  stone: 'Stone Ledger',
  midnight: 'Midnight Dark',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('billing');
  const [settings, setSettings] = useState<StoreSettings>(() => loadSettings());
  const [colours, setColours] = useState<PaintColour[]>(() => loadColours());
  const [rateMemory, setRateMemory] = useState<RateMemoryMap>(() => loadRateMemory());
  const [bills, setBills] = useState<BillRecord[]>(() => loadBills());
  const [customers, setCustomers] = useState<CustomerRecord[]>(() => loadCustomers());
  const [nextBillNo, setNextBillNo] = useState<string>(() => peekNextBillNo());

  // Current active bill workspace items & editing target
  const [currentItems, setCurrentItems] = useState<BillItem[]>([]);
  const [editingBill, setEditingBill] = useState<BillRecord | null>(null);

  // Modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [slipModalData, setSlipModalData] = useState<{
    bill: BillRecord;
    previousBaqaya: number;
  } | null>(null);

  // Apply theme to documentElement cleanly
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'midnight') {
      root.classList.add('dark');
      root.removeAttribute('data-theme');
    } else if (settings.theme === 'stone') {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'stone');
    } else {
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  const customerSummaries = useMemo(
    () => computeCustomerSummaries(customers, bills),
    [customers, bills]
  );

  const handleUpdateSettings = (next: StoreSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const handleCycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(settings.theme);
    const nextTheme = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    handleUpdateSettings({ ...settings, theme: nextTheme });
  };

  // Auto-Rate Memory updation
  const rememberPaintRate = (
    colour: PaintColour,
    packSize: PackSize,
    rate: number
  ) => {
    if (rate <= 0) return;
    setRateMemory((prev) => {
      const next = {
        ...prev,
        [getPaintRateKey(colour.code, colour.name, packSize)]: rate,
        [getPackFallbackKey(packSize)]: rate,
      };
      saveRateMemory(next);
      return next;
    });
  };

  const rememberManualRate = (name: string, unitLabel: string, rate: number) => {
    if (rate <= 0 || !name.trim()) return;
    setRateMemory((prev) => {
      const next = {
        ...prev,
        [getManualRateKey(name, unitLabel)]: rate,
      };
      saveRateMemory(next);
      return next;
    });
  };

  const handleAddPaintItem = (
    colour: PaintColour,
    packSize: PackSize,
    qty: number,
    rate: number
  ) => {
    rememberPaintRate(colour, packSize, rate);
    setCurrentItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        kind: 'paint',
        code: colour.code,
        name: colour.name,
        swatchHex: colour.hex,
        unitLabel: packSize,
        qty,
        rate,
        total: qty * rate,
      },
    ]);
  };

  const handleAddManualItem = (
    name: string,
    unitLabel: string,
    qty: number,
    rate: number
  ) => {
    rememberManualRate(name, unitLabel, rate);
    setCurrentItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        kind: 'manual',
        name,
        unitLabel,
        qty,
        rate,
        total: qty * rate,
      },
    ]);
  };

  const handleCreateCustomColour = (
    code: string,
    name: string,
    hex = '#C7AD8B',
    series = 'Custom'
  ): PaintColour => {
    const created: PaintColour = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code: code.trim(),
      name: name.trim(),
      hex,
      series,
      isCustom: true,
    };
    const updated = saveCustomOrEditedColour(created);
    setColours(updated);
    return created;
  };

  const handleSaveColour = (colour: PaintColour) => {
    const updated = saveCustomOrEditedColour(colour);
    setColours(updated);
  };

  const handleDeleteColour = (id: string) => {
    const updated = deleteColourById(id);
    setColours(updated);
  };

  const handleResetColours = () => {
    const updated = resetColoursToDefault();
    setColours(updated);
  };

  const ensureCustomerRecord = (
    name: string,
    phone: string,
    existingId?: string
  ): string => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || cleanName.toLowerCase() === 'walk-in customer') {
      return 'walkin';
    }

    if (existingId && existingId !== 'walkin') {
      const existing = customers.find((c) => c.id === existingId);
      if (existing) {
        if (cleanPhone && !existing.phone) {
          const updated = customers.map((c) =>
            c.id === existing.id ? { ...c, phone: cleanPhone } : c
          );
          setCustomers(updated);
          saveCustomers(updated);
        }
        return existing.id;
      }
    }

    const match = customers.find(
      (c) =>
        c.name.trim().toLowerCase() === cleanName.toLowerCase() ||
        (cleanPhone &&
          c.phone &&
          c.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''))
    );

    if (match) {
      if (cleanPhone && !match.phone) {
        const updated = customers.map((c) =>
          c.id === match.id ? { ...c, phone: cleanPhone } : c
        );
        setCustomers(updated);
        saveCustomers(updated);
      }
      return match.id;
    }

    const newCustomer: CustomerRecord = {
      id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      phone: cleanPhone,
      payments: [],
      createdAt: Date.now(),
    };
    const updated = [newCustomer, ...customers];
    setCustomers(updated);
    saveCustomers(updated);
    return newCustomer.id;
  };

  const handleSaveBill = (
    draft: Omit<BillRecord, 'id' | 'createdAt' | 'updatedAt' | 'customerId'> & {
      existingCustomerId?: string;
    },
    openPrintSlip: boolean
  ): BillRecord => {
    const customerId = ensureCustomerRecord(
      draft.customerName,
      draft.customerPhone,
      draft.existingCustomerId
    );

    // Also update rate memory for all edited line items
    draft.items.forEach((item) => {
      if (item.rate > 0) {
        if (item.kind === 'paint' && item.code) {
          const matching = colours.find(
            (c) => c.code === item.code && c.name === item.name
          );
          if (matching) {
            rememberPaintRate(matching, item.unitLabel as PackSize, item.rate);
          }
        } else {
          rememberManualRate(item.name, item.unitLabel, item.rate);
        }
      }
    });

    const now = Date.now();
    let savedRecord: BillRecord;
    let nextBills: BillRecord[];

    if (editingBill && editingBill.id) {
      savedRecord = {
        ...editingBill,
        ...draft,
        customerId,
        updatedAt: now,
      };
      nextBills = bills.map((b) => (b.id === editingBill.id ? savedRecord : b));
      setEditingBill(null);
    } else {
      savedRecord = {
        id: `bill_${now}_${Math.random().toString(36).slice(2, 6)}`,
        customerId,
        createdAt: now,
        updatedAt: now,
        ...draft,
      };
      nextBills = [savedRecord, ...bills];
      setNextBillNo(incrementNextBillNo());
      setEditingBill(null);
    }

    setBills(nextBills);
    saveBills(nextBills);

    if (openPrintSlip) {
      const summary = computeCustomerSummaries(customers, nextBills).find(
        (s) => s.customer.id === customerId
      );
      setSlipModalData({
        bill: savedRecord,
        previousBaqaya: summary?.baqaya ?? 0,
      });
    }

    return savedRecord;
  };

  const handleAddCustomerFromLedger = (
    name: string,
    phone: string,
    address?: string
  ) => {
    const created: CustomerRecord = {
      id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      phone,
      address,
      payments: [],
      createdAt: Date.now(),
    };
    const updated = [created, ...customers];
    setCustomers(updated);
    saveCustomers(updated);
  };

  const handleRecordPayment = (
    customerId: string,
    payment: Omit<CustomerPayment, 'id' | 'createdAt'>
  ) => {
    const newPay: CustomerPayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      ...payment,
    };
    const updated = customers.map((c) =>
      c.id === customerId ? { ...c, payments: [newPay, ...c.payments] } : c
    );
    setCustomers(updated);
    saveCustomers(updated);
  };

  const handleDeletePayment = (customerId: string, paymentId: string) => {
    const updated = customers.map((c) =>
      c.id === customerId
        ? { ...c, payments: c.payments.filter((p) => p.id !== paymentId) }
        : c
    );
    setCustomers(updated);
    saveCustomers(updated);
  };

  const handleDeleteBill = (id: string) => {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    saveBills(updated);
  };

  const handleLoadBillForEdit = (bill: BillRecord) => {
    setEditingBill(bill);
    setActiveTab('billing');
  };

  const handleStartNewBill = () => {
    setEditingBill(null);
    setCurrentItems([]);
    setActiveTab('billing');
  };

  const handleQuickAddColourFromCatalog = (colour: PaintColour) => {
    const { rate } = lookupSavedPaintRate(rateMemory, colour.code, colour.name, 'Gallon');
    handleAddPaintItem(colour, 'Gallon', 1, rate ?? 0);
    setActiveTab('billing');
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      bills,
      customers,
      rateMemory,
      customColours: colours.filter((c) => c.isCustom),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hafiz-khata-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (jsonText: string): boolean => {
    try {
      const data = JSON.parse(jsonText);
      if (Array.isArray(data.bills)) {
        setBills(data.bills);
        saveBills(data.bills);
      }
      if (Array.isArray(data.customers)) {
        setCustomers(data.customers);
        saveCustomers(data.customers);
      }
      if (data.rateMemory && typeof data.rateMemory === 'object') {
        setRateMemory(data.rateMemory);
        saveRateMemory(data.rateMemory);
      }
      if (data.settings && typeof data.settings === 'object') {
        const merged = { ...settings, ...data.settings };
        setSettings(merged);
        saveSettings(merged);
      }
      if (Array.isArray(data.customColours)) {
        data.customColours.forEach((c: PaintColour) => {
          saveCustomOrEditedColour({ ...c, isCustom: true });
        });
        setColours(loadColours());
      }
      return true;
    } catch {
      return false;
    }
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'billing', label: 'Billing', icon: <Receipt className="w-4 h-4" /> },
    { id: 'khata', label: 'Khata', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'history', label: 'Bills', icon: <FileText className="w-4 h-4" /> },
    { id: 'colours', label: 'Colours', icon: <SwatchBook className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header
        className="no-print sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#billing"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('billing');
            }}
            className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0"
          >
            {settings.appName}
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'font-semibold' : 'border-transparent hover:opacity-80'
                  }`}
                  style={{
                    borderColor: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleStartNewBill}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="w-4 h-4" />
              <span>New Bill</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="no-print flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10 space-y-5">
        {/* Store Identity & Theme Quick Strip */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              {settings.storeName}
            </h1>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {settings.address} · <span className="font-mono-num">{settings.phone1}</span> ·{' '}
              <span className="font-mono-num">{settings.phone2}</span>
              {settings.email ? ` · ${settings.email}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={handleCycleTheme}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 cursor-pointer shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
              title="Switch professional theme"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: 'var(--accent-text)' }} />
              <span>Theme: {THEME_LABELS[settings.theme]}</span>
            </button>
          </div>
        </div>

        {/* Active View */}
        {activeTab === 'billing' && (
          <BillingWorkspace
            colours={colours}
            rateMemory={rateMemory}
            customerSummaries={customerSummaries}
            settings={settings}
            editingBill={editingBill}
            nextBillNo={nextBillNo}
            items={currentItems}
            setItems={setCurrentItems}
            onOpenScanner={() => setScannerOpen(true)}
            onAddPaintItem={handleAddPaintItem}
            onAddManualItem={handleAddManualItem}
            onCreateCustomColour={handleCreateCustomColour}
            onSaveBill={handleSaveBill}
            onCancelEdit={() => setEditingBill(null)}
          />
        )}

        {activeTab === 'khata' && (
          <KhataLedgerView
            summaries={customerSummaries}
            settings={settings}
            onAddCustomer={handleAddCustomerFromLedger}
            onRecordPayment={handleRecordPayment}
            onDeletePayment={handleDeletePayment}
            onOpenSlip={(bill, baqaya) =>
              setSlipModalData({ bill, previousBaqaya: baqaya })
            }
            onStartBillForCustomer={(name, phone) => {
              setEditingBill({
                id: '',
                billNo: nextBillNo,
                docType: 'Bill',
                date: new Date().toISOString().slice(0, 10),
                customerId: '',
                customerName: name,
                customerPhone: phone,
                items: [],
                subtotal: 0,
                discountType: 'Rs',
                discountValue: 0,
                discountAmount: 0,
                grandTotal: 0,
                receivedAmount: 0,
                remainingBalance: 0,
                paymentStatus: 'Udhaar',
                notes: '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              setActiveTab('billing');
            }}
          />
        )}

        {activeTab === 'history' && (
          <BillsHistoryView
            bills={bills}
            onLoadBillForEdit={handleLoadBillForEdit}
            onOpenSlip={(bill) => {
              const summary = customerSummaries.find(
                (s) => s.customer.id === bill.customerId
              );
              setSlipModalData({
                bill,
                previousBaqaya: summary?.baqaya ?? 0,
              });
            }}
            onDeleteBill={handleDeleteBill}
          />
        )}

        {activeTab === 'colours' && (
          <ColoursCatalogView
            colours={colours}
            onSaveColour={handleSaveColour}
            onCreateColour={handleCreateCustomColour}
            onDeleteColour={handleDeleteColour}
            onResetDefaults={handleResetColours}
            onQuickAddToBill={handleQuickAddColourFromCatalog}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (<= 15% mobile height, >= 44px touch targets) */}
      <nav
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-md"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center justify-center gap-1 min-h-[44px] cursor-pointer"
                style={{
                  color: active ? 'var(--accent-text)' : 'var(--text-muted)',
                }}
              >
                {item.icon}
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Direct Colour Code Scanner Modal */}
      <ColorScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        colours={colours}
        rateMemory={rateMemory}
        onAddColourToBill={handleAddPaintItem}
        onCreateCustomColour={handleCreateCustomColour}
      />

      {/* Print / PDF / WhatsApp Slip Modal */}
      <SlipPreviewModal
        bill={slipModalData?.bill ?? null}
        settings={settings}
        previousBaqaya={slipModalData?.previousBaqaya ?? 0}
        onClose={() => setSlipModalData(null)}
        onChangePrintFormat={(fmt: PrintFormat) =>
          handleUpdateSettings({ ...settings, printFormat: fmt })
        }
      />

      <OfflineIndicator />
    </div>
  );
}
