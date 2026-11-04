import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  Share2,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  Terminal,
  Play,
  QrCode,
  ArrowDownToLine,
  Sparkles
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSimulator?: () => void;
}

export default function DownloadAppModal({
  isOpen,
  onClose,
  onOpenSimulator
}: DownloadAppModalProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'instant' | 'android_project'>('instant');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedGradle, setCopiedGradle] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://jiteautodeals.vercel.app';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyGradle = () => {
    navigator.clipboard.writeText('./gradlew assembleDebug');
    setCopiedGradle(true);
    setTimeout(() => setCopiedGradle(false), 2500);
  };

  const handleTriggerInstall = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallStatus('Installation initiated successfully!');
        setTimeout(() => setInstallStatus(null), 3000);
      }
    } else {
      setInstallStatus('Follow the browser guide below to install in 1 tap.');
      setTimeout(() => setInstallStatus(null), 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Download size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Download & Install Jite Auto Deals
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  v1.0 Official
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Install directly on your Android / iOS phone, or download the full Kotlin project
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            aria-label="Close download modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('instant')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'instant'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone size={16} />
            <span>Install to Phone (Instant 1-Click)</span>
          </button>

          <button
            onClick={() => setActiveTab('android_project')}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'android_project'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownToLine size={16} />
            <span>Native Android Source (ZIP & APK)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {installStatus && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <Sparkles size={16} className="text-amber-400" />
              <span>{installStatus}</span>
            </div>
          )}

          {activeTab === 'instant' ? (
            /* TAB 1: Instant Phone Installation */
            <div className="space-y-6">
              {/* Primary Action Card */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                      <Sparkles size={14} />
                      Zero Store Wait • Full Native Feel
                    </span>
                    <h4 className="text-lg sm:text-xl font-bold text-white">
                      Install Jite Auto Deals Directly to Your Phone
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                      Enjoy lightning-fast vehicle searches, real-time inventory updates from Firestore,
                      inspection booking, and full offline caching with zero storage bloat.
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-2">
                    {isInstalled ? (
                      <div className="px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>Already Installed</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleTriggerInstall}
                        className="px-5 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Download size={18} className="stroke-[2.5]" />
                        <span>{isInstallable ? 'Install App Now' : 'Add to Home Screen'}</span>
                      </button>
                    )}

                    {onOpenSimulator && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenSimulator();
                        }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Play size={13} className="text-amber-400" />
                        <span>Try In-Browser Simulator</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Android Chrome Instructions */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Smartphone size={16} />
                    </div>
                    <h5 className="text-sm font-bold text-white">On Android (Google Chrome)</h5>
                  </div>
                  <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Open this website in <strong>Google Chrome</strong> on your phone.</li>
                    <li>Tap the <strong>three dots (⋮)</strong> menu in top right.</li>
                    <li>Select <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home Screen&quot;</strong>.</li>
                    <li>The Jite Auto Deals app icon will be placed directly onto your home screen!</li>
                  </ol>
                </div>

                {/* iPhone Safari Instructions */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                      <Share2 size={16} />
                    </div>
                    <h5 className="text-sm font-bold text-white">On iPhone / iPad (Safari)</h5>
                  </div>
                  <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>Open this website in <strong>Safari</strong> on iOS.</li>
                    <li>Tap the <strong>Share</strong> button (box with upward arrow <span className="text-amber-400">📤</span>).</li>
                    <li>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong> (➕).</li>
                    <li>Tap <strong>Add</strong> in the top right to complete.</li>
                  </ol>
                </div>
              </div>

              {/* Share / Open URL */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Website & App Link
                  </span>
                  <p className="text-xs font-mono text-amber-400 break-all select-all">
                    {currentUrl}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedUrl ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedUrl ? 'Copied Link' : 'Copy Link'}</span>
                  </button>

                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <ExternalLink size={14} />
                    <span>Open</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: Native Android Source & APK Project */
            <div className="space-y-6">
              {/* Direct Source Download */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                      <Terminal size={14} />
                      Full Kotlin & Jetpack Compose Source Code
                    </span>
                    <h4 className="text-lg font-bold text-white">
                      Download Complete Android Studio Project (.ZIP)
                    </h4>
                    <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                      Contains the full native source with Gradle build files, Material 3 UI screens,
                      shared Cloud Firestore repository, inspection booking, and AndroidManifest.
                    </p>
                  </div>

                  <a
                    href="/api/download-android-project"
                    download="jite-auto-deals-android-app.zip"
                    className="px-5 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                  >
                    <Download size={18} className="stroke-[2.5]" />
                    <span>Download Project (ZIP)</span>
                  </a>
                </div>
              </div>

              {/* Build Instructions */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h5 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal size={16} className="text-amber-400" />
                    How to Compile app-release.apk in Android Studio
                  </h5>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('./gradlew assembleRelease');
                        setCopiedGradle(true);
                        setTimeout(() => setCopiedGradle(false), 2500);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {copiedGradle ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedGradle ? 'Copied' : 'Copy ./gradlew assembleRelease'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 leading-relaxed">
                  <strong>Notice:</strong> Compiling a genuine native Android APK requires the Android SDK, Java JDK (17+), and Gradle build-tools available in Android Studio. The complete native Kotlin &amp; Jetpack Compose project is packaged above ready for 1-click build.
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p>
                      <strong>Download &amp; Extract:</strong> Download the complete project ZIP archive (<code className="text-amber-300">jite-auto-deals-android-app.zip</code>) and extract it to your computer.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p>
                      <strong>Open in Android Studio:</strong> Launch Android Studio and click <strong>File &gt; Open...</strong>, selecting the extracted project folder. Gradle will automatically sync all Jetpack Compose and Firebase dependencies.
                    </p>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="space-y-1.5 w-full">
                      <p>
                        <strong>Build Release APK (app-release.apk):</strong> In Android Studio, go to <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>, or run the following command in terminal:
                      </p>
                      <pre className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-emerald-400 font-mono text-xs overflow-x-auto">
                        ./gradlew assembleRelease
                      </pre>
                      <p className="text-[11px] text-slate-400">
                        Generated APK output: <code className="text-amber-300 font-mono">app/build/outputs/apk/release/app-release.apk</code>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <p>
                      <strong>Install on Android:</strong> Transfer <code className="text-amber-400 font-mono">app-release.apk</code> directly to your Android device via USB, Drive, or WhatsApp, and tap to install.
                    </p>
                  </div>
                </div>
              </div>

              {/* Architecture Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                    Android Package Name
                  </span>
                  <code className="text-amber-400 font-mono font-bold">com.jiteautodeals.app</code>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                    Connected Firestore Database
                  </span>
                  <code className="text-emerald-400 font-mono text-[11px]">
                    ai-studio-jiteautodeals-74aa...
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-400" />
            <span>Verified 100% safe & virus-free • Shared live database</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
