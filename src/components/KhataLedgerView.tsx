import React, { useMemo, useState } from 'react';
import {
  Check,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  BillRecord,
  CustomerPayment,
  StoreSettings,
} from '../types/khata';
import {
  CustomerLedgerSummary,
  formatRs,
  normalizePhoneForWhatsApp,
  todayISO,
} from '../utils/storage';

interface KhataLedgerViewProps {
  summaries: CustomerLedgerSummary[];
  settings: StoreSettings;
  onAddCustomer: (name: string, phone: string, address?: string) => void;
  onRecordPayment: (
    customerId: string,
    payment: Omit<CustomerPayment, 'id' | 'createdAt'>
  ) => void;
  onDeletePayment: (customerId: string, paymentId: string) => void;
  onOpenSlip: (bill: BillRecord, customerBaqaya: number) => void;
  onStartBillForCustomer: (name: string, phone: string) => void;
}

export const KhataLedgerView: React.FC<KhataLedgerViewProps> = ({
  summaries,
  settings,
  onAddCustomer,
  onRecordPayment,
  onDeletePayment,
  onOpenSlip,
  onStartBillForCustomer,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'udhaar' | 'settled'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(
    summaries[0]?.customer.id ?? null
  );

  // Add Customer Inline
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // Recovery Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState<'Cash' | 'Easypaisa' | 'JazzCash' | 'Bank'>('Cash');
  const [payNote, setPayNote] = useState('');
  const [payFeedback, setPayFeedback] = useState<string | null>(null);

  const totals = useMemo(() => {
    const totalBilled = summaries.reduce((s, x) => s + x.totalBilled, 0);
    const totalPaid = summaries.reduce((s, x) => s + x.totalPaid, 0);
    const totalBaqaya = summaries.reduce((s, x) => s + x.baqaya, 0);
    const udhaarCount = summaries.filter((x) => x.baqaya > 0).length;
    return { totalBilled, totalPaid, totalBaqaya, udhaarCount };
  }, [summaries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries
      .filter((s) => {
        if (filter === 'udhaar' && s.baqaya <= 0) return false;
        if (filter === 'settled' && s.baqaya > 0) return false;
        if (!q) return true;
        return (
          s.customer.name.toLowerCase().includes(q) ||
          s.customer.phone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.baqaya - a.baqaya);
  }, [summaries, query, filter]);

  const activeSummary =
    summaries.find((s) => s.customer.id === selectedId) ?? filtered[0] ?? null;

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddCustomer(newName.trim(), newPhone.trim(), newAddress.trim());
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setShowNewCustomer(false);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSummary) return;
    const amt = Math.max(0, Number(payAmount) || 0);
    if (amt <= 0) return;

    onRecordPayment(activeSummary.customer.id, {
      amount: amt,
      date: payDate,
      method: payMethod,
      note: payNote.trim(),
    });
    setPayAmount('');
    setPayNote('');
    setPayFeedback(`Recorded ${formatRs(amt)} recovery payment`);
    setTimeout(() => setPayFeedback(null), 2400);
  };

  const buildKhataWhatsAppHref = (s: CustomerLedgerSummary) => {
    const lines = [
      `*${settings.storeName}*`,
      `${settings.address}`,
      `Mob: ${settings.phone1} / ${settings.phone2}`,
      '--------------------------------',
      `Assalam-o-Alaikum *${s.customer.name}*,`,
      `Khata Account Summary:`,
      `Total Billed: ${formatRs(s.totalBilled)}`,
      `Total Paid: ${formatRs(s.totalPaid)}`,
      `*Remaining Balance (Baqaya): ${formatRs(s.baqaya)}*`,
      '--------------------------------',
      settings.footerNote,
    ];
    const phone = normalizePhoneForWhatsApp(s.customer.phone);
    return phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`
      : `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  return (
    <div className="space-y-5">
      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Total Market Udhaar (Baqaya)
          </div>
          <div className="text-2xl font-bold font-mono-num mt-1 text-red-600 dark:text-red-400">
            {formatRs(totals.totalBaqaya)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {totals.udhaarCount} customer{totals.udhaarCount === 1 ? '' : 's'} with pending balance
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Total Collected (Wasool)
          </div>
          <div className="text-2xl font-bold font-mono-num mt-1 text-emerald-600 dark:text-emerald-400">
            {formatRs(totals.totalPaid)}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Bills &amp; Khata recoveries combined
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Total Customer Accounts
          </div>
          <div className="text-2xl font-bold font-mono-num mt-1">{summaries.length}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Lifetime billed: <span className="font-mono-num">{formatRs(totals.totalBilled)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left List of Customers */}
        <div
          className="lg:col-span-5 rounded-xl border overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div
            className="p-4 border-b space-y-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Customer Khata List</h2>
              <button
                type="button"
                onClick={() => setShowNewCustomer((v) => !v)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Customer</span>
              </button>
            </div>

            {showNewCustomer && (
              <form
                onSubmit={handleCreateCustomer}
                className="p-3 rounded-lg border space-y-2.5"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Customer Full Name"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Phone (03XX...)"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border text-sm font-mono-num"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-strong)',
                    }}
                  />
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Village / Area"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border text-sm"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-strong)',
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(false)}
                    className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Save Customer
                  </button>
                </div>
              </form>
            )}

            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer name or phone..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-strong)',
                }}
              />
            </div>

            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-lg border"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {(
                [
                  ['all', 'All'],
                  ['udhaar', 'Udhaar'],
                  ['settled', 'Settled'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className="min-h-[36px] px-2 py-1 rounded-md text-xs font-medium cursor-pointer"
                  style={{
                    backgroundColor: filter === key ? 'var(--bg-surface)' : 'transparent',
                    color: filter === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No customer khata records found. Save a bill with a customer name or click New Customer.
            </div>
          ) : (
            <div className="divide-y max-h-[540px] overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
              {filtered.map((s) => {
                const active = activeSummary?.customer.id === s.customer.id;
                return (
                  <button
                    key={s.customer.id}
                    type="button"
                    onClick={() => setSelectedId(s.customer.id)}
                    className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{s.customer.name}</div>
                      <div className="text-xs font-mono-num truncate" style={{ color: 'var(--text-muted)' }}>
                        {s.customer.phone || 'No phone'} · {s.customerBills.length} bill
                        {s.customerBills.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-bold font-mono-num ${
                          s.baqaya > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatRs(s.baqaya)}
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {s.baqaya > 0 ? 'Baqaya' : 'Settled'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Customer Detail & Recovery Ledger */}
        <div className="lg:col-span-7 space-y-4">
          {!activeSummary ? (
            <div
              className="rounded-xl border p-10 text-center text-sm"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              Select a customer from the left to view their Khata statement and record payments.
            </div>
          ) : (
            <>
              {/* Account Header Card */}
              <div
                className="rounded-xl border p-5 space-y-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{activeSummary.customer.name}</h2>
                    <div className="text-xs font-mono-num mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {activeSummary.customer.phone || 'No phone saved'}
                      {activeSummary.customer.address
                        ? ` · ${activeSummary.customer.address}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onStartBillForCustomer(
                          activeSummary.customer.name,
                          activeSummary.customer.phone
                        )
                      }
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Bill</span>
                    </button>
                    <a
                      href={buildKhataWhatsAppHref(activeSummary)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Send Khata WhatsApp</span>
                    </a>
                  </div>
                </div>

                <div
                  className="grid grid-cols-3 gap-3 pt-3 border-t"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Total Billed
                    </div>
                    <div className="text-base font-bold font-mono-num mt-0.5">
                      {formatRs(activeSummary.totalBilled)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Total Received
                    </div>
                    <div className="text-base font-bold font-mono-num mt-0.5 text-emerald-600 dark:text-emerald-400">
                      {formatRs(activeSummary.totalPaid)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Remaining Baqaya
                    </div>
                    <div
                      className={`text-base font-bold font-mono-num mt-0.5 ${
                        activeSummary.baqaya > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatRs(activeSummary.baqaya)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Record Recovery Payment Form */}
              <div
                className="rounded-xl border p-5 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
                    <h3 className="text-sm font-semibold">
                      Add Recovery Payment (Wasooli)
                    </h3>
                  </div>
                  {activeSummary.baqaya > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(Math.round(activeSummary.baqaya)))}
                      className="text-xs font-semibold hover:underline cursor-pointer"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      Fill Full Baqaya ({formatRs(activeSummary.baqaya)})
                    </button>
                  )}
                </div>

                {payFeedback && (
                  <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>{payFeedback}</span>
                  </div>
                )}

                <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-3">
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Amount (Rs.)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Method
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) =>
                        setPayMethod(e.target.value as 'Cash' | 'Easypaisa' | 'JazzCash' | 'Bank')
                      }
                      className="w-full min-h-[42px] px-2.5 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Easypaisa">Easypaisa</option>
                      <option value="JazzCash">JazzCash</option>
                      <option value="Bank">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full min-h-[42px] px-2.5 py-2 rounded-lg border text-sm font-mono-num"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Save Payment
                    </button>
                  </div>
                  <div className="sm:col-span-12">
                    <input
                      type="text"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      placeholder="Optional note (e.g. Received via brother, part payment)"
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border text-xs"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    />
                  </div>
                </form>
              </div>

              {/* Bills & Payment History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="px-4 py-3 border-b text-sm font-semibold"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    Bills ({activeSummary.customerBills.length})
                  </div>
                  {activeSummary.customerBills.length === 0 ? (
                    <div className="p-5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      No bills recorded for this customer yet.
                    </div>
                  ) : (
                    <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                      {activeSummary.customerBills.map((b) => (
                        <div key={b.id} className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="font-mono-num font-semibold text-sm">{b.billNo}</div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              {b.date} · {b.items.length} item{b.items.length === 1 ? '' : 's'} · {b.paymentStatus}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right font-mono-num">
                              <div className="font-semibold">{formatRs(b.grandTotal)}</div>
                              {b.remainingBalance > 0 && (
                                <div className="text-[11px] text-red-600 dark:text-red-400">
                                  Due: {formatRs(b.remainingBalance)}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenSlip(b, activeSummary.baqaya)}
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-md border cursor-pointer"
                              style={{
                                backgroundColor: 'var(--bg-subtle)',
                                borderColor: 'var(--border-subtle)',
                              }}
                              aria-label="Print bill"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="rounded-xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="px-4 py-3 border-b text-sm font-semibold"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    Recovery History ({activeSummary.customer.payments.length})
                  </div>
                  {activeSummary.customer.payments.length === 0 ? (
                    <div className="p-5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      No later recovery payments recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
                      {activeSummary.customer.payments.map((p) => (
                        <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="font-mono-num font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                              +{formatRs(p.amount)}
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              {p.date} · {p.method}
                              {p.note ? ` · ${p.note}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onDeletePayment(activeSummary.customer.id, p.id)
                            }
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-md text-red-600 hover:bg-red-500/10 cursor-pointer"
                            aria-label="Remove payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
