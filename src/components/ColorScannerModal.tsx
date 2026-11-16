import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Plus,
  ScanLine,
  Search,
  X,
} from 'lucide-react';
import { PACK_SIZES, PackSize, PaintColour } from '../types/khata';
import { formatRs, lookupSavedPaintRate } from '../utils/storage';
import { RateMemoryMap } from '../types/khata';

interface DetectedCode {
  code: string;
  name?: string;
  confidence?: string;
}

interface ColorScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  colours: PaintColour[];
  rateMemory: RateMemoryMap;
  onAddColourToBill: (colour: PaintColour, packSize: PackSize, qty: number, rate: number) => void;
  onCreateCustomColour: (code: string, name: string) => PaintColour;
}

export const ColorScannerModal: React.FC<ColorScannerModalProps> = ({
  isOpen,
  onClose,
  colours,
  rateMemory,
  onAddColourToBill,
  onCreateCustomColour,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedCode[]>([]);
  const [manualScanText, setManualScanText] = useState('');
  const [selectedPack, setSelectedPack] = useState<PackSize>('Gallon');
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null);

  // Stop camera cleanly on close or unmount
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanError(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setCameraError(
        'Camera access unavailable in this browser. Use Upload / Take Photo or enter the shade code directly below.'
      );
    }
  };

  const scanImageDataUrl = async (dataUrl: string, mimeType: string) => {
    setPreviewUrl(dataUrl);
    setScanning(true);
    setScanError(null);
    setDetected([]);

    try {
      const res = await fetch('/api/scan-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setScanError(payload.error || 'Could not read shade code from image.');
        setScanning(false);
        return;
      }

      const codes: DetectedCode[] = Array.isArray(payload.detectedCodes)
        ? payload.detectedCodes
        : [];
      setDetected(codes);

      if (codes.length === 0) {
        setScanError(
          'No clear shade number found in this photo. Try closer lighting or type the number below.'
        );
      }
    } catch {
      setScanError('Network error while scanning. Please check connection or enter code manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleCaptureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    scanImageDataUrl(dataUrl, 'image/jpeg');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        stopCamera();
        scanImageDataUrl(reader.result, file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Match codes from either AI scan or quick barcode/manual input
  const quickTokens = manualScanText
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const combinedQueries: DetectedCode[] = [
    ...detected,
    ...quickTokens.map((t) => ({ code: t, confidence: 'manual' })),
  ];

  const findMatchesForQuery = (q: DetectedCode): PaintColour[] => {
    const codeNorm = q.code.trim().toLowerCase();
    const nameNorm = (q.name || '').trim().toLowerCase();
    return colours.filter((c) => {
      const cCode = c.code.toLowerCase();
      const cName = c.name.toLowerCase();
      if (codeNorm && cCode === codeNorm) return true;
      if (codeNorm && cCode.includes(codeNorm) && codeNorm.length >= 2) return true;
      if (nameNorm && cName.includes(nameNorm) && nameNorm.length >= 3) return true;
      return false;
    });
  };

  const handleQuickAdd = (colour: PaintColour) => {
    const { rate } = lookupSavedPaintRate(rateMemory, colour.code, colour.name, selectedPack);
    onAddColourToBill(colour, selectedPack, 1, rate ?? 0);
    setAddedFeedback(`${colour.code} ${colour.name} (${selectedPack})`);
    setTimeout(() => setAddedFeedback(null), 2200);
  };

  const handleCreateAndAdd = (code: string, name?: string) => {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = (name || '').trim() || `Custom Shade ${cleanCode}`;
    const created = onCreateCustomColour(cleanCode, cleanName);
    handleQuickAdd(created);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Colour Code Scanner"
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border shadow-xl flex flex-col"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <ScanLine className="w-5 h-5" style={{ color: 'var(--accent-text)' }} />
            <h2 className="text-base font-semibold">Direct Colour Code Scanner</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
            style={{ backgroundColor: 'var(--bg-subtle)' }}
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Camera / Photo Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={cameraActive ? stopCamera : startCamera}
              className="min-h-[46px] px-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 text-white transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Camera className="w-4 h-4" />
              <span>{cameraActive ? 'Stop Live Camera' : 'Open Live Camera'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[46px] px-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 border transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <ImagePlus className="w-4 h-4" />
              <span>Take / Upload Tin Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {cameraError && (
            <div className="p-3 rounded-lg border text-sm border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              {cameraError}
            </div>
          )}

          {/* Live Video Viewfinder */}
          {cameraActive && (
            <div className="relative rounded-xl overflow-hidden border bg-black" style={{ borderColor: 'var(--border-strong)' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full max-h-64 object-cover"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-28 border-2 border-white/80 rounded-lg shadow-sm" />
              </div>
              <div className="p-3 bg-black/75 flex items-center justify-between gap-3">
                <span className="text-xs text-white/85">
                  Point camera at shade number (e.g. 413, M211, 1708)
                </span>
                <button
                  type="button"
                  onClick={handleCaptureFrame}
                  className="min-h-[42px] px-4 py-2 rounded-lg text-sm font-semibold bg-white text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  Capture &amp; Scan
                </button>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Preview & Scanning State */}
          {previewUrl && !cameraActive && (
            <div
              className="flex items-center gap-3 p-3 rounded-lg border"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-subtle)' }}
            >
              <img
                src={previewUrl}
                alt="Scanned label"
                className="w-16 h-16 rounded-md object-cover border shrink-0"
                style={{ borderColor: 'var(--border-strong)' }}
              />
              <div className="min-w-0 flex-1">
                {scanning ? (
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-text)' }} />
                    <span>Reading colour numbers from photo...</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium">
                    {detected.length > 0
                      ? `Found ${detected.length} shade code${detected.length > 1 ? 's' : ''}`
                      : 'Scan complete'}
                  </p>
                )}
              </div>
            </div>
          )}

          {scanError && (
            <div className="p-3 rounded-lg border text-sm border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
              {scanError}
            </div>
          )}

          {/* Direct Barcode / Multi-Code Input */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              USB Scanner / Direct Multi-Code Entry (separate multiple codes with space or comma)
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={manualScanText}
                onChange={(e) => setManualScanText(e.target.value)}
                placeholder="Scan barcode or type e.g. 413 450 M211 8001..."
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-lg border text-sm font-mono-num focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Default Pack Size for Quick Add */}
          <div>
            <span className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Pack Size for Quick Add
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {PACK_SIZES.map((pack) => {
                const active = selectedPack === pack;
                return (
                  <button
                    key={pack}
                    type="button"
                    onClick={() => setSelectedPack(pack)}
                    className="min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap"
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
          </div>

          {addedFeedback && (
            <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Added {addedFeedback} to bill</span>
            </div>
          )}

          {/* Matched Shades List */}
          {combinedQueries.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Matched Paint Shades</h3>
              {combinedQueries.map((q, qIdx) => {
                const matches = findMatchesForQuery(q);
                return (
                  <div
                    key={`${q.code}-${qIdx}`}
                    className="rounded-lg border p-3 space-y-2"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-canvas)',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span>
                        Detected: <strong className="font-mono-num">{q.code}</strong>
                        {q.name ? ` · ${q.name}` : ''}
                      </span>
                      <span>{matches.length} match{matches.length === 1 ? '' : 'es'}</span>
                    </div>

                    {matches.length > 0 ? (
                      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {matches.slice(0, 8).map((c) => {
                          const { rate } = lookupSavedPaintRate(rateMemory, c.code, c.name, selectedPack);
                          return (
                            <div
                              key={c.id}
                              className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className="w-6 h-6 rounded border shrink-0"
                                  style={{
                                    backgroundColor: c.hex,
                                    borderColor: 'var(--border-strong)',
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    <span className="font-mono-num font-semibold mr-1.5">{c.code}</span>
                                    <span>{c.name}</span>
                                  </div>
                                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {c.series} · {selectedPack}
                                    {rate ? ` · ${formatRs(rate)}` : ' · Enter rate in bill'}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleQuickAdd(c)}
                                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                                style={{ backgroundColor: 'var(--accent)' }}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Not in pre-loaded list. Add as custom shade?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCreateAndAdd(q.code, q.name)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-strong)',
                          }}
                        >
                          Save &amp; Add {q.code}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
