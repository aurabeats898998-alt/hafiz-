import React, { useMemo, useState } from 'react';
import { Edit3, Printer, Search, Trash2 } from 'lucide-react';
import { BillRecord } from '../types/khata';
import { formatRs } from '../utils/storage';

interface BillsHistoryViewProps {
  bills: BillRecord[];
  onLoadBillForEdit: (bill: BillRecord) => void;
  onOpenSlip: (bill: BillRecord) => void;
  onDeleteBill: (id: string) => void;
}

export const BillsHistoryView: React.FC<BillsHistoryViewProps> = ({
  bills,
  onLoadBillForEdit,
  onOpenSlip,
  onDeleteBill,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'Bill' | 'Quotation' | 'udhaar'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bills
      .filter((b) => {
        if (filter === 'Bill' && b.docType !== 'Bill') return false;
        if (filter === 'Quotation' && b.docType !== 'Quotation') return false;
        if (filter === 'udhaar' && (b.docType !== 'Bill' || b.remainingBalance <= 0)) {
          return false;
        }
        if (!q) return true;
        return (
          b.billNo.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.customerPhone.toLowerCase().includes(q) ||
          b.items.some(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              (i.code && i.code.toLowerCase().includes(q))
          )
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [bills, query, filter]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div
        className="p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h2 className="text-base font-semibold">Saved Bills &amp; Quotations ({bills.length})</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Search by bill #, customer, or colour code to reprint or edit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bill #, customer, shade..."
              className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div
            className="inline-flex p-1 rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {(
              [
                ['all', 'All'],
                ['Bill', 'Bills'],
                ['Quotation', 'Quotes'],
                ['udhaar', 'Udhaar'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className="min-h-[34px] px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer"
                style={{
                  backgroundColor: filter === k ? 'var(--bg-surface)' : 'transparent',
                  color: filter === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No bills or quotations match your filter.
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
                <th className="py-3 px-4">Bill #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Items</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-right">Baqaya</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 px-4 font-mono-num font-semibold whitespace-nowrap">
                    {b.billNo}
                  </td>
                  <td
                    className="py-3 px-3 font-mono-num text-xs whitespace-nowrap"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {b.date}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium">{b.customerName}</div>
                    {b.customerPhone && (
                      <div className="text-xs font-mono-num" style={{ color: 'var(--text-muted)' }}>
                        {b.customerPhone}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {b.items.length} item{b.items.length === 1 ? '' : 's'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-num font-semibold whitespace-nowrap">
                    {formatRs(b.grandTotal)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono-num font-semibold whitespace-nowrap ${
                      b.remainingBalance > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {b.docType === 'Quotation' ? '—' : formatRs(b.remainingBalance)}
                  </td>
                  <td className="py-3 px-3 text-xs whitespace-nowrap">
                    {b.docType === 'Quotation' ? 'Quotation' : b.paymentStatus}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenSlip(b)}
                        className="min-h-[36px] px-2.5 py-1 rounded-md border text-xs font-medium flex items-center gap-1 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Slip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onLoadBillForEdit(b)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md border cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                        }}
                        aria-label="Edit bill"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBill(b.id)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-red-600 hover:bg-red-500/10 cursor-pointer"
                        aria-label="Delete bill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
