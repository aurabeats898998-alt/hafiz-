import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  // Direct 1-click native Chromium/Android install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer shrink-0 transition-opacity hover:opacity-95 ${
          variant === 'card' ? 'w-full justify-center min-h-[44px] text-sm' : ''
        }`}
        style={{ backgroundColor: 'var(--accent)' }}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari guided install (or fallback manual Add to Home Screen modal in Settings card)
  if (isIOS || variant === 'card') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 ${
            variant === 'card' ? 'w-full justify-center min-h-[44px] text-sm' : ''
          }`}
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text-primary)',
          }}
        >
          <Smartphone className="w-3.5 h-3.5" style={{ color: 'var(--accent-text)' }} />
          <span>{isIOS ? 'Install on iPhone' : 'Install Shortcut Guide'}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              className="w-full max-w-sm rounded-xl border p-5 shadow-xl space-y-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/pwa-192x192.png"
                    alt="Hafiz App Icon"
                    className="w-10 h-10 rounded-xl shadow-sm"
                  />
                  <div>
                    <h3 className="text-base font-bold leading-tight">Install Hafiz App</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Al Hafiz Paint Store
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="p-1.5 rounded-lg hover:opacity-80 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <ol
                  className="text-xs sm:text-sm space-y-2 list-decimal list-inside leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <li>
                    Tap the <strong className="inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline" /> Share</strong> button in Safari&apos;s toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> — the Hafiz logo icon will appear on your home screen.
                  </li>
                </ol>
              ) : (
                <ol
                  className="text-xs sm:text-sm space-y-2 list-decimal list-inside leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <li>
                    Open this page in <strong>Google Chrome</strong> (not an in-app browser).
                  </li>
                  <li>
                    Tap the <strong>3-dot menu (⋮)</strong> in the top-right corner.
                  </li>
                  <li>
                    Tap <strong>Add to Home screen</strong> → <strong>Install</strong> to add the Hafiz app with its logo.
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full min-h-[42px] rounded-lg text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="no-print fixed bottom-20 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-lg"
      style={{ backgroundColor: '#b45309' }}
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Local Khata active</span>
    </div>
  );
};
