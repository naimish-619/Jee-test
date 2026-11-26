import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, Monitor, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F4C81]/30 bg-[#0F4C81]/5 px-3 py-2 text-xs font-semibold text-[#0F4C81] hover:bg-[#0F4C81]/10 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F4C81]"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        Install App
      </button>

      {showGuide &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
          >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
                <h2 id="install-guide-title" className="text-base font-semibold text-slate-900">
                  Install as Standalone Desktop App
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-600 leading-relaxed">
              {isInIframe && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 space-y-2">
                  <p className="font-semibold">Opened inside an embedded preview frame</p>
                  <p>
                    Browsers hide the native Install option inside embedded previews. Open your published URL (such as your GitHub Pages link) directly in a standalone browser tab first.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        URL Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        Copy App URL
                      </>
                    )}
                  </button>
                </div>
              )}

              {isIOS ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-700">
                  <li>
                    Tap the <strong>Share</strong> button in your Safari toolbar.
                  </li>
                  <li>
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </li>
                </ol>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-800">
                    Chrome / Edge / Supermium (Windows 8, 10, 11):
                  </p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700">
                    <li>Open the published app URL directly in its own browser tab (not inside an iframe).</li>
                    <li>
                      Click the browser menu (<strong>⋮</strong> or <strong>⋯</strong>) in the top-right corner.
                    </li>
                    <li>
                      Select <strong>Cast, save, and share → Install page as app...</strong> (or{' '}
                      <strong>Apps → Install this site as an app</strong> /{' '}
                      <strong>More tools → Create shortcut... → Open as window</strong>).
                    </li>
                    <li>
                      Confirm <strong>Install</strong> to create an offline desktop shortcut.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg bg-[#0F4C81] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3A63] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
