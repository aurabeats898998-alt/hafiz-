import React, { useRef, useState } from 'react';
import { Check, Download, Palette, Store, Upload } from 'lucide-react';
import { PrintFormat, StoreSettings, ThemeId } from '../types/khata';

interface SettingsViewProps {
  settings: StoreSettings;
  onUpdateSettings: (next: StoreSettings) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => boolean;
}

const THEMES: Array<{
  id: ThemeId;
  title: string;
  desc: string;
  swatchBg: string;
  swatchAccent: string;
}> = [
  {
    id: 'daylight',
    title: 'Atelier Daylight',
    desc: 'Crisp porcelain light canvas with cobalt blue actions',
    swatchBg: '#f8fafc',
    swatchAccent: '#1d4ed8',
  },
  {
    id: 'stone',
    title: 'Warm Stone Ledger',
    desc: 'Soft travertine ledger paper with deep teal accents',
    swatchBg: '#f6f4ef',
    swatchAccent: '#0f766e',
  },
  {
    id: 'midnight',
    title: 'Midnight Counter',
    desc: 'Low-glare deep slate dark mode for evening counter use',
    swatchBg: '#0b1120',
    swatchAccent: '#0284c7',
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onExportBackup,
  onImportBackup,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<StoreSettings>(settings);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draft);
    setSavedNotice('Store profile & slip settings saved');
    setTimeout(() => setSavedNotice(null), 2400);
  };

  const handleThemeSelect = (themeId: ThemeId) => {
    const updated = { ...draft, theme: themeId };
    setDraft(updated);
    onUpdateSettings(updated);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const ok = onImportBackup(reader.result);
        setSavedNotice(
          ok ? 'Backup restored successfully' : 'Invalid backup JSON file'
        );
        setTimeout(() => setSavedNotice(null), 2600);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Store Profile & Print Slip Config */}
      <form
        onSubmit={handleSave}
        className="lg:col-span-7 rounded-xl border p-5 space-y-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
          <h2 className="text-base font-semibold">Print Slip &amp; Store Details</h2>
        </div>

        {savedNotice && (
          <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{savedNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Print Slip Store Name
            </label>
            <input
              type="text"
              value={draft.storeName}
              onChange={(e) => setDraft({ ...draft, storeName: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-medium"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              App Name
            </label>
            <input
              type="text"
              value={draft.appName}
              onChange={(e) => setDraft({ ...draft, appName: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-medium"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Shop Address
            </label>
            <input
              type="text"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Mobile Number 1
            </label>
            <input
              type="tel"
              value={draft.phone1}
              onChange={(e) => setDraft({ ...draft, phone1: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Mobile Number 2
            </label>
            <input
              type="tel"
              value={draft.phone2}
              onChange={(e) => setDraft({ ...draft, phone2: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="e.g. alhafizpaints@gmail.com"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Default Print Slip Format
            </label>
            <select
              value={draft.printFormat}
              onChange={(e) =>
                setDraft({ ...draft, printFormat: e.target.value as PrintFormat })
              }
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <option value="a4">A4 / A5 Store Invoice</option>
              <option value="thermal">80mm Thermal Slip</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Print Slip Footer Note
            </label>
            <input
              type="text"
              value={draft.footerNote}
              onChange={(e) => setDraft({ ...draft, footerNote: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Save Store Settings
          </button>
        </div>
      </form>

      {/* Professional Themes & Backup */}
      <div className="lg:col-span-5 space-y-5">
        <div
          className="rounded-xl border p-5 space-y-3.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
            <h2 className="text-base font-semibold">Professional Themes</h2>
          </div>

          <div className="space-y-2.5">
            {THEMES.map((t) => {
              const active = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeSelect(t.id)}
                  className="w-full p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                    borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg border flex items-end justify-end p-1.5 shrink-0"
                      style={{
                        backgroundColor: t.swatchBg,
                        borderColor: 'var(--border-strong)',
                      }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-sm"
                        style={{ backgroundColor: t.swatchAccent }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.title}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t.desc}
                      </div>
                    </div>
                  </div>
                  {active && (
                    <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="rounded-xl border p-5 space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <h2 className="text-base font-semibold">Khata Data Backup (localStorage)</h2>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            All bills, customer khatas, saved rates, and custom shades are automatically saved on this device. Export a JSON backup anytime for safekeeping.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onExportBackup}
              className="min-h-[42px] px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <Download className="w-4 h-4" />
              <span>Export Backup</span>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-[42px] px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
              }}
            >
              <Upload className="w-4 h-4" />
              <span>Restore Backup</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
