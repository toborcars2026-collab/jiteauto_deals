import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  MessageSquare,
  Car,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  HelpCircle,
  Phone,
  RotateCcw,
  CheckCircle2,
  Check,
  ArrowRight,
  Layers,
  MapPin,
  Clock
} from 'lucide-react';
import { Vehicle, AIConsultantMessage, BusinessSettings } from '../types';
import {
  formatCurrency,
  getImageUrl,
  getWhatsAppLink,
  safeOpenWhatsApp,
  saveLead,
  cleanFirestoreData
} from '../utils';
import { trackFunnelEvent } from '../services/aiConsultantAnalytics';
import { JITE_AI_KNOWLEDGE } from '../data/aiKnowledge';

interface AIConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  activeVehicle?: Vehicle | null;
  onViewVehicleDetails: (vehicle: Vehicle) => void;
  businessSettings?: BusinessSettings;
  initialPrompt?: string | null;
}

export default function AIConsultantModal({
  isOpen,
  onClose,
  vehicles,
  activeVehicle,
  onViewVehicleDetails,
  businessSettings,
  initialPrompt
}: AIConsultantModalProps) {
  const [messages, setMessages] = useState<AIConsultantMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSourcingForm, setShowSourcingForm] = useState(false);
  const [sourcingName, setSourcingName] = useState('');
  const [sourcingPhone, setSourcingPhone] = useState('');
  const [sourcingSuccess, setSourcingSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize conversation
  useEffect(() => {
    if (!isOpen) return;

    trackFunnelEvent('aiOpened');

    if (messages.length === 0) {
      if (activeVehicle) {
        // Vehicle-specific initial consultation
        const welcomeText = `Hello! I'm your Jite AI Vehicle Consultant. I see you're viewing the **${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}** (listed at ${formatCurrency(activeVehicle.price)}). 

Would you like to know about its mechanical inspection status, test-drive booking in ${activeVehicle.location}, or how the purchase process works?`;

        setMessages([
          {
            id: 'init_car_' + Date.now(),
            sender: 'ai',
            text: welcomeText,
            timestamp: Date.now(),
            matchedVehicleIds: [activeVehicle.id],
            suggestedActions: [
              'Can I inspect this vehicle?',
              'How do I buy this?',
              'What are the full specifications?',
              'Connect on WhatsApp with Jite'
            ],
            isHighIntent: false,
            whatsAppSummary: `Hello Jite Auto Deals, I am interested in the ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} (${formatCurrency(activeVehicle.price)}). Please let me know its availability and inspection schedule.`
          }
        ]);
      } else {
        // General welcome
        const welcomeText = `👋 **Welcome to Jite Auto Deals!**

I'm your **Jite AI Vehicle Consultant**. I help you navigate the Nigerian automotive market with clarity and zero guesswork.

Tell me what you're looking for, and I'll match verified options or guide you on inspection and sourcing.`;

        setMessages([
          {
            id: 'init_gen_' + Date.now(),
            sender: 'ai',
            text: welcomeText,
            timestamp: Date.now(),
            matchedVehicleIds: [],
            suggestedActions: [
              '🚘 Find an SUV under ₦25M',
              '💰 I have a budget, help me choose',
              '📋 View available vehicles',
              '🤝 How Jite Auto Deals works',
              '💬 Speak with Tobor Jite'
            ],
            isHighIntent: false
          }
        ]);
      }
    }

    if (initialPrompt && initialPrompt.trim()) {
      handleSendMessage(initialPrompt.trim());
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, [isOpen, activeVehicle]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    trackFunnelEvent('aiConversations');

    const userMsg: AIConsultantMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call server-side API proxy /api/ai/consultant
      const res = await fetch('/api/ai/consultant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: text,
          history: messages.slice(-5),
          activeVehicle: activeVehicle || null,
          vehicles: vehicles.slice(0, 25)
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();

      const aiMsg: AIConsultantMessage = {
        id: 'ai_' + Date.now(),
        sender: 'ai',
        text: data.replyText || 'I am happy to assist you in selecting the right car.',
        timestamp: Date.now(),
        matchedVehicleIds: Array.isArray(data.matchedVehicleIds) ? data.matchedVehicleIds : [],
        suggestedActions: Array.isArray(data.suggestedActions) ? data.suggestedActions : ['Browse Cars', 'Find My Car', 'Chat on WhatsApp'],
        isHighIntent: Boolean(data.isHighIntent),
        sourcingOpportunity: Boolean(data.sourcingOpportunity),
        whatsAppSummary: data.whatsAppSummary || `Hello Jite Auto Deals, I was chatting with your AI Consultant regarding: "${text}".`
      };

      if (aiMsg.isHighIntent) {
        trackFunnelEvent('enquiriesStarted');
      }

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.warn('[AI Consultant] Backend fallback activated:', err);
      // Client-side instant graceful fallback
      const fallbackText = `I hear you! When choosing a vehicle in Nigeria, transparency and mechanical health are the most critical factors. Every car recommended by Jite Auto Deals is physically pre-inspected with computerized diagnostics and customs duty clearance before payment.

Would you like to speak directly with **Tobor Jite** on WhatsApp to discuss your exact preferences?`;

      setMessages((prev) => [
        ...prev,
        {
          id: 'ai_fallback_' + Date.now(),
          sender: 'ai',
          text: fallbackText,
          timestamp: Date.now(),
          matchedVehicleIds: activeVehicle ? [activeVehicle.id] : [],
          suggestedActions: ['Chat with Jite on WhatsApp', 'Browse Verified Cars', 'How inspections work'],
          isHighIntent: true,
          whatsAppSummary: `Hello Jite Auto Deals, I was using the AI consultant and I'd like to consult on: "${text}".`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle WhatsApp Handoff
  const handleWhatsAppHandoff = (customText?: string) => {
    trackFunnelEvent('whatsAppClicks');

    const defaultSummary = activeVehicle
      ? `Hello Jite Auto Deals, I was assisted by the Jite AI Vehicle Consultant regarding the ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} (${formatCurrency(activeVehicle.price)}). I'd like to confirm availability and purchase/inspection details.`
      : `Hello Jite Auto Deals, I was assisted by the Jite AI Vehicle Consultant on your website and I'd like to discuss suitable vehicle options.`;

    const message = customText || defaultSummary;
    const url = getWhatsAppLink(message, businessSettings?.whatsAppNumber);
    safeOpenWhatsApp(url);
  };

  // Handle Quick Action Click
  const handleQuickAction = (action: string) => {
    if (action.includes('WhatsApp') || action.includes('Speak with') || action.includes('Connect on WhatsApp')) {
      handleWhatsAppHandoff();
      return;
    }
    if (action.includes('Sourcing Request') || action.includes('Submit Sourcing')) {
      setShowSourcingForm(true);
      return;
    }
    handleSendMessage(action);
  };

  // Handle Sourcing Form Submit
  const handleSourcingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourcingName.trim() || !sourcingPhone.trim()) return;

    saveLead({
      name: sourcingName.trim(),
      phone: sourcingPhone.trim(),
      vehicleType: 'AI Sourcing Request',
      budget: activeVehicle ? activeVehicle.price : 20000000,
      brand: activeVehicle ? activeVehicle.make : 'Custom Sourcing',
      paymentMethod: 'Cash',
      requirements: `AI Consultant Sourcing Request from conversation: ${messages.slice(-3).map(m => m.text).join(' | ')}`,
      type: 'source_car',
      source: 'ai_consultant',
      aiSummary: messages.slice(-4).map(m => `${m.sender}: ${m.text}`).join('\n'),
      whatsappHandoff: true
    });

    trackFunnelEvent('leadsSubmitted');
    trackFunnelEvent('sourcingRequests');

    setSourcingSuccess(true);
    setTimeout(() => {
      setShowSourcingForm(false);
      setSourcingSuccess(false);

      const successReply: AIConsultantMessage = {
        id: 'sourcing_success_' + Date.now(),
        sender: 'ai',
        text: `Thank you, **${sourcingName}**! Your sourcing request has been received by Jite Auto Deals. Tobor Jite will review your criteria and contact you promptly at **${sourcingPhone}**. 

You can also start an immediate WhatsApp chat below:`,
        timestamp: Date.now(),
        suggestedActions: ['Chat with Jite now on WhatsApp', 'Browse other stock'],
        isHighIntent: true,
        whatsAppSummary: `Hello Jite Auto Deals, I just submitted a vehicle sourcing request under the name ${sourcingName} (${sourcingPhone}). Let's discuss available options!`
      };
      setMessages((prev) => [...prev, successReply]);
    }, 1500);
  };

  // Reset conversation
  const handleResetChat = () => {
    setMessages([]);
    setShowSourcingForm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[90vh] sm:h-[85vh] max-h-[850px] overflow-hidden text-slate-100">
        
        {/* Header Strip */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/95 border-b border-slate-800 shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-base sm:text-lg text-white">
                  Jite AI <span className="text-amber-400">Vehicle Consultant</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Nigeria's Trusted Automotive Sourcing & Advisory Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetChat}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close consultant"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Active Vehicle Context Tag (if user is viewing a car) */}
        {activeVehicle && (
          <div className="bg-slate-950/60 border-b border-slate-800/80 px-5 py-2.5 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 text-slate-300 truncate">
              <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Context
              </span>
              <span className="truncate font-semibold">
                {activeVehicle.year} {activeVehicle.make} {activeVehicle.model} ({formatCurrency(activeVehicle.price)})
              </span>
            </div>
            <button
              type="button"
              onClick={() => onViewVehicleDetails(activeVehicle)}
              className="text-amber-400 hover:underline text-[11px] font-semibold shrink-0 cursor-pointer"
            >
              View Specs
            </button>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => {
            const isAi = msg.sender === 'ai';
            const matchedVehicles = (msg.matchedVehicleIds || [])
              .map((id) => vehicles.find((v) => v.id === id))
              .filter(Boolean) as Vehicle[];

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} space-y-2`}
              >
                {/* Avatar Label */}
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400 font-mono">
                  {isAi ? (
                    <>
                      <span className="text-amber-400 font-bold">Jite AI Consultant</span>
                      <span>•</span>
                      <span>Automotive Advisor</span>
                    </>
                  ) : (
                    <span>You</span>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${
                    isAi
                      ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                      : 'bg-amber-500 text-slate-950 font-medium rounded-tr-sm shadow-amber-500/10'
                  }`}
                >
                  <div className="whitespace-pre-line space-y-2">{msg.text}</div>
                </div>

                {/* Vehicle Recommendations Cards (if returned by AI) */}
                {isAi && matchedVehicles.length > 0 && (
                  <div className="w-full max-w-full my-2 space-y-3">
                    <div className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Car size={13} />
                      <span>Verified Inventory Matches ({matchedVehicles.length})</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {matchedVehicles.map((car) => (
                        <div
                          key={car.id}
                          className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden hover:border-amber-500/40 transition-all flex flex-col group shadow-md"
                        >
                          <div className="relative aspect-[16/10] w-full bg-slate-900 overflow-hidden">
                            <img
                              src={getImageUrl(car.images?.[0])}
                              alt={`${car.year} ${car.make} ${car.model}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => {
                                e.currentTarget.src =
                                  'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=1200';
                              }}
                            />
                            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-amber-400 border border-amber-500/20">
                              {car.condition || 'Foreign Used'}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-black text-white border border-slate-700">
                              {formatCurrency(car.price)}
                            </div>
                          </div>

                          <div className="p-3.5 flex flex-col flex-grow justify-between space-y-2.5">
                            <div>
                              <h4 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                                {car.year} {car.make} {car.model}
                              </h4>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin size={11} className="text-amber-400" />
                                <span>{car.location || 'Lagos'}</span>
                                <span>•</span>
                                <span>{car.transmission || 'Automatic'}</span>
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => {
                                  trackFunnelEvent('vehiclesViewed');
                                  onViewVehicleDetails(car);
                                }}
                                className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <span>Details</span>
                                <ChevronRight size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  trackFunnelEvent('whatsAppClicks');
                                  const msg = `Hello Jite Auto Deals! I'm interested in the ${car.year} ${car.make} ${car.model} (${formatCurrency(car.price)}) located in ${car.location}. Please let me know availability!`;
                                  handleWhatsAppHandoff(msg);
                                }}
                                className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <MessageSquare size={13} />
                                <span>WhatsApp</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* High-Intent WhatsApp Handoff Card */}
                {isAi && (msg.isHighIntent || msg.whatsAppSummary) && (
                  <div className="w-full my-2 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 shadow-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <MessageSquare size={18} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-bold text-sm text-emerald-300">
                          Direct WhatsApp Consultation Ready
                        </h4>
                        <p className="text-xs text-slate-300">
                          Connect with Tobor Jite to confirm pricing, lock in an inspection, or review verification documents.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleWhatsAppHandoff(msg.whatsAppSummary)}
                            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                          >
                            <MessageSquare size={16} />
                            <span>CHAT WITH JITE AUTO DEALS</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sourcing Opportunity Card */}
                {isAi && msg.sourcingOpportunity && (
                  <div className="w-full my-2 p-4 rounded-2xl bg-slate-950 border border-amber-500/40 shadow-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                        <Search size={18} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="font-bold text-sm text-amber-300">
                          Vehicle Sourcing Service
                        </h4>
                        <p className="text-xs text-slate-300">
                          Can't find this exact model in current stock? We source and physically inspect verified cars across Nigeria.
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowSourcingForm(true)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span>Request This Vehicle</span>
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Action Suggestion Chips */}
                {isAi && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 max-w-[95%]">
                    {msg.suggestedActions.map((action, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickAction(action)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 transition-all cursor-pointer select-none active:scale-95"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Thinking / Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-slate-800/60 rounded-2xl text-xs text-amber-400 max-w-fit border border-slate-700/60">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Jite AI is searching verified inventory and crafting advice...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Modal Inline Sourcing Form Drawer */}
        {showSourcingForm && (
          <div className="p-4 bg-slate-950 border-t border-amber-500/30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                <Search size={14} /> Submit Vehicle Sourcing Request
              </span>
              <button
                type="button"
                onClick={() => setShowSourcingForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSourcingSubmit} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  required
                  value={sourcingName}
                  onChange={(e) => setSourcingName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="tel"
                  placeholder="Phone / WhatsApp (e.g. 08180823197)"
                  required
                  value={sourcingPhone}
                  onChange={(e) => setSourcingPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="submit"
                disabled={sourcingSuccess}
                className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {sourcingSuccess ? (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Sourcing Request Submitted!</span>
                  </>
                ) : (
                  <>
                    <span>Submit Sourcing Request to Jite Auto Deals</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-950/95 border-t border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about a car, price in ₦, family SUV, or inspection..."
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold transition-all cursor-pointer shrink-0"
              title="Send message"
            >
              <Send size={18} />
            </button>
          </form>

          {/* Micro trust strip */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 px-1 font-mono">
            <span className="flex items-center gap-1">
              <Shield size={11} className="text-amber-400" />
              Verified Inspection • Customs Duty Assured
            </span>
            <button
              type="button"
              onClick={() => handleWhatsAppHandoff()}
              className="text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <MessageSquare size={11} />
              WhatsApp Direct
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
