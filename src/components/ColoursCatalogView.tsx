import React, { useMemo, useState } from 'react';
import { Edit3, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { PaintColour } from '../types/khata';

interface ColoursCatalogViewProps {
  colours: PaintColour[];
  onSaveColour: (colour: PaintColour) => void;
  onCreateColour: (code: string, name: string, hex?: string, series?: string) => PaintColour;
  onDeleteColour: (id: string) => void;
  onResetDefaults: () => void;
  onQuickAddToBill: (colour: PaintColour) => void;
}

export const ColoursCatalogView: React.FC<ColoursCatalogViewProps> = ({
  colours,
  onSaveColour,
  onCreateColour,
  onDeleteColour,
  onResetDefaults,
  onQuickAddToBill,
}) => {
  const [query, setQuery] = useState('');
  const [seriesFilter, setSeriesFilter] = useState<string>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editHex, setEditHex] = useState('#D4BE98');

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#C7AD8B');
  const [newSeries, setNewSeries] = useState('Custom');

  const seriesList = useMemo(() => {
    const set = new Set(colours.map((c) => c.series));
    return ['All', ...Array.from(set)];
  }, [colours]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return colours.filter((c) => {
      if (seriesFilter !== 'All' && c.series !== seriesFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.series.toLowerCase().includes(q)
      );
    });
  }, [colours, query, seriesFilter]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    onCreateColour(newCode.trim(), newName.trim(), newHex, newSeries);
    setNewCode('');
    setNewName('');
  };

  const startEdit = (c: PaintColour) => {
    setEditingId(c.id);
    setEditCode(c.code);
    setEditName(c.name);
    setEditHex(c.hex);
  };

  const saveEdit = (c: PaintColour) => {
    if (!editCode.trim() || !editName.trim()) return;
    onSaveColour({
      ...c,
      code: editCode.trim(),
      name: editName.trim(),
      hex: editHex,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      {/* Add Custom Colour Bar */}
      <form
        onSubmit={handleAddSubmit}
        className="rounded-xl border p-4 sm:p-5 space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            Add New Colour Shade ({colours.length} total shades)
          </h2>
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-xs font-medium flex items-center gap-1 cursor-pointer hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default Database</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Colour Code
            </label>
            <input
              type="text"
              required
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. 912"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm font-mono-num"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Colour Name
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Royal Ivory"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Series
            </label>
            <input
              type="text"
              value={newSeries}
              onChange={(e) => setNewSeries(e.target.value)}
              placeholder="Custom"
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              Swatch
            </label>
            <input
              type="color"
              value={newHex}
              onChange={(e) => setNewHex(e.target.value)}
              className="w-full h-[42px] p-1 rounded-lg border cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Save Colour</span>
            </button>
          </div>
        </div>
      </form>

      {/* Search & Series Filter */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div
          className="p-4 border-b flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter shades by code or name..."
              className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-strong)',
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {seriesList.map((sr) => (
              <button
                key={sr}
                type="button"
                onClick={() => setSeriesFilter(sr)}
                className="min-h-[36px] px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer"
                style={{
                  backgroundColor:
                    seriesFilter === sr ? 'var(--accent)' : 'var(--bg-subtle)',
                  borderColor:
                    seriesFilter === sr ? 'var(--accent)' : 'var(--border-subtle)',
                  color: seriesFilter === sr ? '#ffffff' : 'var(--text-primary)',
                }}
              >
                {sr}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:gap-px" style={{ backgroundColor: 'var(--border-subtle)' }}>
          {filtered.slice(0, 180).map((c) => {
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className="p-3.5 flex items-center justify-between gap-3"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                {isEditing ? (
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={editHex}
                      onChange={(e) => setEditHex(e.target.value)}
                      className="w-9 h-9 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-20 min-h-[36px] px-2 py-1 rounded border text-xs font-mono-num"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-strong)' }}
                    />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-[100px] min-h-[36px] px-2 py-1 rounded border text-xs"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-strong)' }}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(c)}
                      className="px-2.5 py-1.5 rounded text-xs font-semibold text-white cursor-pointer"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-8 h-8 rounded-md border shrink-0"
                        style={{
                          backgroundColor: c.hex,
                          borderColor: 'var(--border-strong)',
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          <span className="font-mono-num mr-1.5">{c.code}</span>
                          <span>{c.name}</span>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {c.series}
                          {c.isCustom ? ' · Custom' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onQuickAddToBill(c)}
                        className="min-h-[34px] px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        + Bill
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-md hover:opacity-80 cursor-pointer"
                        aria-label={`Edit ${c.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteColour(c.id)}
                        className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-md text-red-600 hover:bg-red-500/10 cursor-pointer"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {filtered.length > 180 && (
          <div
            className="p-3 text-center text-xs border-t"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            Showing first 180 of {filtered.length} matching shades. Narrow your search to see specific shades.
          </div>
        )}
      </div>
    </div>
  );
};
