import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Wifi,
  Battery,
  Home,
  Car,
  Calendar,
  User,
  Search,
  MessageSquare,
  Phone,
  ArrowLeft,
  Maximize2,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronRight,
  Shield,
  Clock,
  MapPin,
  Code,
  Download
} from 'lucide-react';
import { Vehicle, BusinessSettings } from '../types';
import { formatCurrency, getWhatsAppLink, getBusinessPhoneDisplay } from '../utils';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface AndroidAppSimulatorModalProps {
  isOpen: boolean;
  onClose: () => Unit;
  vehicles: Vehicle[];
  businessSettings: BusinessSettings;
  onOpenDownloadModal?: () => void;
}

type Unit = void;
type AndroidTab = 'home' | 'inventory' | 'inspections' | 'consultant';

export default function AndroidAppSimulatorModal({
  isOpen,
  onClose,
  vehicles,
  businessSettings,
  onOpenDownloadModal
}: AndroidAppSimulatorModalProps) {
  const [currentTab, setCurrentTab] = useState<AndroidTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [inspectingVehicle, setInspectingVehicle] = useState<Vehicle | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFullscreenPhoto, setIsFullscreenPhoto] = useState(false);
  const [showCodeInspector, setShowCodeInspector] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Inspection form states
  const [fullName, setFullName] = useState('');
  const [whatsappNum, setWhatsappNum] = useState('');
  const [inspDate, setInspDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [inspTime, setInspTime] = useState('11:00 AM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeVehicles = vehicles.filter(
    (v) => (v.status || 'Available').toLowerCase() === 'available' || (v.status || '').toLowerCase() === 'active'
  );

  const featuredVehicles = activeVehicles.filter((v) => v.isFeatured);

  const makes = ['All', ...Array.from(new Set(activeVehicles.map((v) => v.make).filter(Boolean))).sort()];

  const filteredVehicles = activeVehicles.filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      String(v.year).includes(q) ||
      (v.location || '').toLowerCase().includes(q);

    const matchesMake = !selectedMake || selectedMake === 'All' || v.make.toLowerCase() === selectedMake.toLowerCase();

    return matchesQuery && matchesMake;
  });

  const handleBookInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingVehicle) return;

    if (!fullName.trim()) {
      setFormError('Please enter your full name');
      return;
    }
    if (!whatsappNum.trim()) {
      setFormError('Please enter your WhatsApp number');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      // Save to shared Firestore /inquiries collection
      const docRef = await addDoc(collection(db, 'inquiries'), {
        name: fullName.trim(),
        phone: whatsappNum.trim(),
        vehicleId: inspectingVehicle.id,
        vehicleName: `${inspectingVehicle.year} ${inspectingVehicle.make} ${inspectingVehicle.model}`,
        vehiclePrice: inspectingVehicle.price,
        vehicleLocation: inspectingVehicle.location,
        type: 'inspection',
        preferredDate: inspDate,
        preferredTime: inspTime,
        preferredContact: 'WhatsApp',
        readyToBuy: 'Immediate',
        status: 'New',
        createdAt: new Date().toISOString(),
        message: `Android Native App inspection booking for ${inspectingVehicle.year} ${inspectingVehicle.make} ${inspectingVehicle.model} in ${inspectingVehicle.location}.`
      });

      setBookingSuccess(`Inspection request confirmed! Reference ID: ${docRef.id.slice(0, 8)}`);

      // WhatsApp handoff
      const msg = `Hello Tobor Jite! I just booked an inspection via the Jite Auto Deals Android App for:\n\n🚗 *${inspectingVehicle.year} ${inspectingVehicle.make} ${inspectingVehicle.model}*\n💰 Price: ${formatCurrency(inspectingVehicle.price)}\n📍 Location: ${inspectingVehicle.location}\n📅 Date: ${inspDate}\n⏰ Time: ${inspTime}\n👤 Name: ${fullName}\n📱 WhatsApp: ${whatsappNum}\n\nLooking forward to the physical verification.`;
      const waUrl = getWhatsAppLink(msg, businessSettings.whatsAppNumber);

      setTimeout(() => {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit inspection booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyAndroidInstructions = () => {
    const text = `# Jite Auto Deals Native Android Mobile App
Package: com.jiteautodeals.app
Firebase Database: ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a

Source code location: /android
To build in Android Studio:
1. Open /android in Android Studio
2. Run ./gradlew assembleDebug (outputs APK at android/app/build/outputs/apk/debug/app-debug.apk)
3. Run ./gradlew bundleRelease (outputs AAB for Google Play at android/app/build/outputs/bundle/release/app-release.aab)`;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-4 flex flex-col max-h-[96vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Smartphone size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Jite Auto Deals — Official Android Native Mobile App
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                  Shared Firestore Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Package: <code className="text-amber-400 font-mono">com.jiteautodeals.app</code> • Kotlin & Jetpack Compose
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/download-android-project"
              download="jite-auto-deals-android-app.zip"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Download Full Android Studio Project ZIP"
            >
              <Download size={14} className="stroke-[2.5]" />
              <span className="hidden sm:inline">Download ZIP</span>
            </a>
            {onOpenDownloadModal && (
              <button
                onClick={onOpenDownloadModal}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                title="Install app directly to your phone"
              >
                <Smartphone size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Install to Phone</span>
              </button>
            )}
            <button
              onClick={() => setShowCodeInspector(!showCodeInspector)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Code size={14} className="text-amber-400" />
              <span>{showCodeInspector ? 'Show Simulator' : 'Source Code'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center bg-slate-950/50">
          {showCodeInspector ? (
            /* Android Source Code & APK Export Guide */
            <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-200 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h4 className="text-base font-bold text-white">Native Android Project Ready for Compilation</h4>
                  <p className="text-xs text-slate-400">
                    Source code configured at <code className="text-amber-400">/android</code> sharing database{' '}
                    <code className="text-amber-400">ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a</code>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/download-android-project"
                    download="jite-auto-deals-android-app.zip"
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Download size={14} className="stroke-[2.5]" />
                    <span>Download Project (.ZIP)</span>
                  </a>
                  <button
                    onClick={handleCopyAndroidInstructions}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {copiedCode ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Copied' : 'Copy Build Info'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                  <span className="text-[11px] font-mono font-bold text-amber-400 block mb-1">
                    PROJECT ARCHITECTURE
                  </span>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li>Kotlin 1.9.22 + Jetpack Compose Material 3</li>
                    <li>Firebase BOM (Firestore, Auth, Storage)</li>
                    <li>Direct link to Firestore database</li>
                    <li>Real-time vehicle collection stream</li>
                    <li>Deep link: <code className="text-amber-300">jiteautodeals.vercel.app/vehicle/*</code></li>
                  </ul>
                </div>

                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                  <span className="text-[11px] font-mono font-bold text-amber-400 block mb-1">
                    GRADLE BUILD TARGETS
                  </span>
                  <div className="text-xs font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1 text-slate-300">
                    <p className="text-slate-400"># Build Debug APK:</p>
                    <p className="text-emerald-400">./gradlew assembleDebug</p>
                    <p className="text-slate-400 mt-2"># Build Production AAB (Google Play):</p>
                    <p className="text-emerald-400">./gradlew bundleRelease</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <span className="text-[11px] font-mono font-bold text-amber-400 block mb-2">
                  PROJECT FILE TREE IN CODEBASE
                </span>
                <pre className="text-[11px] font-mono text-slate-400 overflow-x-auto leading-relaxed">
{`/android
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
├── README.md
└── app
    ├── build.gradle.kts
    ├── google-services.json (Shared Firebase config)
    └── src/main
        ├── AndroidManifest.xml
        ├── res/values/{strings,colors,themes}.xml
        └── java/com/jiteautodeals/app/
            ├── MainActivity.kt
            ├── data/
            │   ├── model/{Vehicle,Inquiry,BusinessSettings}.kt
            │   └── repository/FirestoreRepository.kt
            └── ui/
                ├── theme/{Color,Theme}.kt
                ├── viewmodel/VehicleViewModel.kt
                └── screens/{HomeScreen,InventoryScreen,VehicleDetailsScreen,InspectionBookingDialog}.kt`}
                </pre>
              </div>
            </div>
          ) : (
            /* Live Interactive Android Phone Frame */
            <div className="relative w-[340px] sm:w-[370px] h-[680px] bg-[#070D18] rounded-[44px] border-[6px] border-slate-800 shadow-2xl flex flex-col overflow-hidden select-none ring-1 ring-white/10">
              {/* Android Top Notch / Status Bar */}
              <div className="h-8 bg-[#0A1424] px-5 flex items-center justify-between text-white text-[11px] font-medium shrink-0">
                <span className="font-semibold">09:41</span>
                {/* Punch-hole camera */}
                <div className="w-3 h-3 rounded-full bg-black border border-slate-800" />
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Wifi size={11} />
                  <span className="text-[9px] font-mono font-bold">5G</span>
                  <Battery size={13} className="text-emerald-400" />
                </div>
              </div>

              {/* Android Top App Bar */}
              <div className="px-4 py-2.5 bg-[#0A1424] border-b border-slate-800/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {viewingVehicle ? (
                    <button
                      onClick={() => setViewingVehicle(null)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-amber-400 flex items-center gap-1 text-xs font-bold"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                  ) : (
                    <>
                      <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xs">
                        J
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white tracking-wider leading-none">
                          JITE AUTO DEALS
                        </h4>
                        <span className="text-[9px] text-amber-400 font-medium">Your Trusted Vehicle Consultant</span>
                      </div>
                    </>
                  )}
                </div>

                <a
                  href={getWhatsAppLink('Hello Tobor Jite! Browsing from the Jite Auto Deals Android App.', businessSettings.whatsAppNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all"
                  title="WhatsApp Tobor Jite"
                >
                  <MessageSquare size={13} />
                </a>
              </div>

              {/* Android Screen Body Content */}
              <div className="flex-1 overflow-y-auto bg-[#070D18] text-white p-3 space-y-3">
                {viewingVehicle ? (
                  /* Detail Screen on Android */
                  <div className="space-y-3">
                    {/* Main Photo with "TAP TO VIEW FULL PHOTO" */}
                    <div
                      onClick={() => setIsFullscreenPhoto(true)}
                      className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer group"
                    >
                      <img
                        src={viewingVehicle.images[activePhotoIndex] || viewingVehicle.images[0]}
                        alt={viewingVehicle.make}
                        className="w-full h-full object-cover"
                      />
                      {/* Tap to view full photo badge */}
                      <div className="absolute bottom-2.5 left-2.5 bg-slate-950/85 text-white backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-black border border-white/20 flex items-center gap-1">
                        <Maximize2 size={10} className="text-amber-400" />
                        <span>TAP TO VIEW FULL PHOTO</span>
                      </div>
                      <div className="absolute bottom-2.5 right-2.5 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono">
                        {activePhotoIndex + 1}/{viewingVehicle.images.length}
                      </div>
                    </div>

                    {/* Thumbnails */}
                    {viewingVehicle.images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {viewingVehicle.images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setActivePhotoIndex(i)}
                            className={`w-12 h-10 rounded-lg overflow-hidden shrink-0 border ${
                              activePhotoIndex === i ? 'border-amber-400' : 'border-slate-800'
                            }`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">
                        {viewingVehicle.condition} • 📍 {viewingVehicle.location}
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {viewingVehicle.year} {viewingVehicle.make} {viewingVehicle.model}
                      </h3>
                      <p className="text-lg font-black text-amber-400 mt-0.5">
                        {formatCurrency(viewingVehicle.price)}
                      </p>
                    </div>

                    {/* CTA BOOK INSPECTION */}
                    <button
                      onClick={() => setInspectingVehicle(viewingVehicle)}
                      className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all"
                    >
                      <Calendar size={14} />
                      <span>BOOK INSPECTION</span>
                    </button>

                    <a
                      href={getWhatsAppLink(
                        `Hello Tobor Jite! I am interested in the ${viewingVehicle.year} ${viewingVehicle.make} ${viewingVehicle.model} (${formatCurrency(viewingVehicle.price)}) in ${viewingVehicle.location}.`,
                        businessSettings.whatsAppNumber
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare size={13} />
                      <span>Chat on WhatsApp</span>
                    </a>

                    {/* Specs List */}
                    <div className="bg-[#0A1424] rounded-xl p-3 border border-slate-800 space-y-1.5 text-xs">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Specs</span>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Hub</span>
                          <span className="font-bold text-slate-200">{viewingVehicle.location}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Transmission</span>
                          <span className="font-bold text-slate-200">{viewingVehicle.transmission}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Fuel</span>
                          <span className="font-bold text-slate-200">{viewingVehicle.fuelType}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Body</span>
                          <span className="font-bold text-slate-200">{viewingVehicle.bodyType}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : currentTab === 'home' ? (
                  /* Home Tab */
                  <div className="space-y-3">
                    {/* Welcome Card */}
                    <div className="bg-gradient-to-br from-[#0F1E36] to-[#0A1424] border border-amber-500/20 rounded-2xl p-3.5 space-y-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-black tracking-wider uppercase">
                        Verified Vehicle Advisory
                      </span>
                      <h4 className="text-sm font-bold text-white">Buy with Confidence in Nigeria</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed font-light">
                        150+ point pre-purchase technical verification, verified customs & title documents.
                      </p>
                      <button
                        onClick={() => setCurrentTab('inventory')}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs"
                      >
                        BROWSE AVAILABLE INVENTORY ({activeVehicles.length})
                      </button>
                    </div>

                    {/* Featured Vehicles Carousel */}
                    {featuredVehicles.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                          Featured Highlights
                        </span>
                        <div className="space-y-2.5">
                          {featuredVehicles.slice(0, 3).map((v) => (
                            <div
                              key={v.id}
                              className="bg-[#0A1424] border border-slate-800 rounded-2xl overflow-hidden p-2.5 space-y-2"
                            >
                              <div
                                onClick={() => {
                                  setViewingVehicle(v);
                                  setActivePhotoIndex(0);
                                }}
                                className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-900 cursor-pointer relative"
                              >
                                <img src={v.images[0]} alt={v.make} className="w-full h-full object-cover" />
                                <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded">
                                  FEATURED
                                </span>
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-white truncate">
                                  {v.year} {v.make} {v.model}
                                </h5>
                                <div className="flex items-center justify-between text-xs mt-0.5">
                                  <span className="font-black text-amber-400">{formatCurrency(v.price)}</span>
                                  <span className="text-[10px] text-slate-400">📍 {v.location}</span>
                                </div>
                              </div>
                              {/* Exact CTA Buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setInspectingVehicle(v)}
                                  className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[11px]"
                                >
                                  BOOK INSPECTION
                                </button>
                                <button
                                  onClick={() => {
                                    setViewingVehicle(v);
                                    setActivePhotoIndex(0);
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-[11px]"
                                >
                                  View Details ↗
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : currentTab === 'inventory' ? (
                  /* Inventory Tab */
                  <div className="space-y-3">
                    {/* Search Field */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-amber-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search make, model, year..."
                        className="w-full bg-[#0A1424] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Make Chips */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {makes.map((make) => {
                        const isSelected = (!selectedMake && make === 'All') || selectedMake === make;
                        return (
                          <button
                            key={make}
                            onClick={() => setSelectedMake(make === 'All' ? null : make)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-[#0A1424] text-slate-300 border border-slate-800'
                            }`}
                          >
                            {make}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2.5">
                      {filteredVehicles.map((v) => (
                        <div
                          key={v.id}
                          className="bg-[#0A1424] border border-slate-800 rounded-2xl overflow-hidden p-2.5 space-y-2"
                        >
                          <div
                            onClick={() => {
                              setViewingVehicle(v);
                              setActivePhotoIndex(0);
                            }}
                            className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-900 cursor-pointer relative"
                          >
                            <img src={v.images[0]} alt={v.make} className="w-full h-full object-cover" />
                            <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-slate-950/80 text-amber-400 font-bold text-[9px] rounded">
                              {v.condition}
                            </span>
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-slate-950/80 text-white text-[9px] rounded">
                              📍 {v.location}
                            </span>
                          </div>

                          <div>
                            <h5 className="text-xs font-bold text-white truncate">
                              {v.year} {v.make} {v.model}
                            </h5>
                            <span className="font-black text-amber-400 text-xs">{formatCurrency(v.price)}</span>
                          </div>

                          {/* EXACT CTA FLOW: [ BOOK INSPECTION ] (Primary Yellow) + [ View Details ↗ ] */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setInspectingVehicle(v)}
                              className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[11px]"
                            >
                              BOOK INSPECTION
                            </button>
                            <button
                              onClick={() => {
                                setViewingVehicle(v);
                                setActivePhotoIndex(0);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-[11px]"
                            >
                              View Details ↗
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : currentTab === 'inspections' ? (
                  /* Inspections Tab */
                  <div className="space-y-3 text-xs">
                    <div className="bg-[#0A1424] p-3 rounded-2xl border border-slate-800 space-y-2">
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                        Technical Inspection Process
                      </span>
                      <h4 className="text-sm font-bold text-white">How We Protect Buyers</h4>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        Every booked inspection includes full engine compression testing, OBD-II scanner diagnostics,
                        chassis inspection, and VIN Customs verification in Abuja, Lagos, and Port Harcourt.
                      </p>
                      <button
                        onClick={() => setCurrentTab('inventory')}
                        className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                      >
                        Choose a Car to Inspect
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Consultant Profile Tab */
                  <div className="space-y-3 text-xs">
                    <div className="bg-[#0A1424] p-3 rounded-2xl border border-slate-800 space-y-2 text-center">
                      <div className="w-14 h-14 rounded-full bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center mx-auto">
                        TJ
                      </div>
                      <h4 className="text-sm font-bold text-white">Tobor Jite</h4>
                      <p className="text-amber-400 text-[11px]">Founder & Chief Vehicle Consultant</p>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        Dedicated to transparent automotive acquisition and pre-purchase verification across Nigeria.
                      </p>
                      <div className="pt-2 flex flex-col gap-2">
                        <a
                          href={getWhatsAppLink('Hello Tobor Jite! Contacting via Android App.', businessSettings.whatsAppNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1"
                        >
                          <MessageSquare size={13} />
                          <span>WhatsApp Consultant</span>
                        </a>
                        <a
                          href={businessSettings.phoneCallUrl}
                          className="py-2 bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1"
                        >
                          <Phone size={13} />
                          <span>Call: {businessSettings.phoneDisplay}</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Android Bottom Navigation Bar */}
              <div className="h-14 bg-[#0A1424] border-t border-slate-800/80 px-2 flex items-center justify-around shrink-0">
                <button
                  onClick={() => {
                    setCurrentTab('home');
                    setViewingVehicle(null);
                  }}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                    currentTab === 'home' && !viewingVehicle ? 'text-amber-400 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Home size={16} />
                  <span>Home</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentTab('inventory');
                    setViewingVehicle(null);
                  }}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                    currentTab === 'inventory' && !viewingVehicle ? 'text-amber-400 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Car size={16} />
                  <span>Inventory</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentTab('inspections');
                    setViewingVehicle(null);
                  }}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                    currentTab === 'inspections' && !viewingVehicle ? 'text-amber-400 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Calendar size={16} />
                  <span>Inspections</span>
                </button>

                <button
                  onClick={() => {
                    setCurrentTab('consultant');
                    setViewingVehicle(null);
                  }}
                  className={`flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                    currentTab === 'consultant' && !viewingVehicle ? 'text-amber-400 font-bold' : 'text-slate-400'
                  }`}
                >
                  <User size={16} />
                  <span>Consultant</span>
                </button>
              </div>

              {/* Android Navigation Bar Pill / Gesture handle */}
              <div className="h-3 bg-[#070D18] flex items-center justify-center shrink-0">
                <div className="w-24 h-1 bg-slate-600 rounded-full" />
              </div>

              {/* In-App Inspection Booking Modal on Android */}
              {inspectingVehicle && (
                <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-3 animate-fadeIn">
                  <div className="bg-[#0A1424] border border-slate-700 rounded-2xl p-4 w-full text-white space-y-3 max-h-[92%] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">Book a Vehicle Inspection</h4>
                      <button onClick={() => setInspectingVehicle(null)} className="text-slate-400 p-1">
                        <X size={16} />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      Interested in this vehicle? Choose a convenient time and we'll arrange your inspection.
                    </p>

                    {/* Dynamically Identified Vehicle Info */}
                    <div className="bg-[#070D18] p-2.5 rounded-xl border border-slate-800 text-xs">
                      <p className="font-bold text-white">
                        {inspectingVehicle.year} {inspectingVehicle.make} {inspectingVehicle.model}
                      </p>
                      <p className="font-black text-amber-400">{formatCurrency(inspectingVehicle.price)}</p>
                      <p className="text-[10px] text-slate-400">📍 {inspectingVehicle.location}</p>
                    </div>

                    {bookingSuccess ? (
                      <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs space-y-1">
                        <p className="font-bold">✓ Inspection Scheduled!</p>
                        <p className="text-[11px] text-slate-200">{bookingSuccess}</p>
                        <button
                          onClick={() => {
                            setBookingSuccess(null);
                            setInspectingVehicle(null);
                          }}
                          className="w-full mt-2 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleBookInspectionSubmit} className="space-y-2.5 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Full Name *</label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Your full name"
                            required
                            className="w-full bg-[#070D18] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">WhatsApp Number *</label>
                          <input
                            type="tel"
                            value={whatsappNum}
                            onChange={(e) => setWhatsappNum(e.target.value)}
                            placeholder="e.g. 0802 318 4543"
                            required
                            className="w-full bg-[#070D18] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Date *</label>
                            <input
                              type="date"
                              value={inspDate}
                              onChange={(e) => setInspDate(e.target.value)}
                              required
                              className="w-full bg-[#070D18] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Time *</label>
                            <input
                              type="text"
                              value={inspTime}
                              onChange={(e) => setInspTime(e.target.value)}
                              placeholder="11:00 AM"
                              required
                              className="w-full bg-[#070D18] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        {formError && <p className="text-[11px] text-rose-400">{formError}</p>}

                        {/* Button text: "BOOK INSPECTION" (Not "Continue to WhatsApp") */}
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                        >
                          {isSubmitting ? 'Submitting...' : 'BOOK INSPECTION'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {/* Fullscreen Photo Lightbox on Android */}
              {isFullscreenPhoto && viewingVehicle && (
                <div className="absolute inset-0 z-40 bg-black flex flex-col justify-between p-3 animate-fadeIn">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsFullscreenPhoto(false)}
                      className="p-1.5 rounded-full bg-slate-900 text-white"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <img
                      src={viewingVehicle.images[activePhotoIndex] || viewingVehicle.images[0]}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="text-center text-[10px] text-slate-400">
                    {activePhotoIndex + 1} of {viewingVehicle.images.length}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
