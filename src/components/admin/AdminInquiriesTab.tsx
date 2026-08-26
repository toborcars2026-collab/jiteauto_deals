import React, { useState } from 'react';
import { Phone, MessageSquare, Car, Search, CheckCircle2 } from 'lucide-react';
import { Inquiry, LeadStatus } from '../../types';
import { formatCurrency, updateInquiry, saveInquiryStatus } from '../../utils';

interface AdminInquiriesTabProps {
  inquiries: Inquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<Inquiry[]>>;
}

export default function AdminInquiriesTab({ inquiries, setInquiries }: AdminInquiriesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All');

  const handleUpdateStatus = async (id: string, newStatus: LeadStatus) => {
    const updated = updateInquiry(id, { status: newStatus });
    setInquiries(updated);
    try {
      await saveInquiryStatus(id, newStatus);
    } catch (e) {
      console.warn('Status updated in local cache, syncing to Firestore:', e);
    }
  };

  const filteredInquiries = inquiries.filter((inq) => {
    const matchesSearch =
      !searchTerm.trim() ||
      `${inq.name} ${inq.phone} ${inq.vehicleName} ${inq.message || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' ? true : inq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
          <Phone className="text-blue-600" size={22} />
          <span>Vehicle Inquiries ("Get This Car" Purchase Intent)</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          Direct acquisition inquiries triggered when serious buyers submit their budget and timeline on specific catalog vehicles.
        </p>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search inquiries by client name, vehicle name, phone..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs font-medium"
          />
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 font-mono">Status:</span>
          {(['All', 'New', 'Contacted', 'In Progress', 'Completed', 'Closed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st as any)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Inquiries List */}
      {filteredInquiries.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <Phone size={36} className="mx-auto text-slate-300" />
          <p className="text-slate-500 text-sm font-semibold">No vehicle inquiries found matching current filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inq) => {
            const cleanPhone = inq.phone.replace(/\D/g, '');

            return (
              <div
                key={inq.id}
                className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-amber-300 transition-all shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display font-bold text-base text-slate-900">{inq.name}</span>

                    <span className="text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                      {inq.preferredContact || 'WhatsApp'} Preferred
                    </span>

                    {/* Status Dropdown */}
                    <select
                      value={inq.status || 'New'}
                      onChange={(e) => handleUpdateStatus(inq.id, e.target.value as LeadStatus)}
                      className={`text-[11px] font-bold font-mono uppercase px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                        inq.status === 'New'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : inq.status === 'Contacted'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : inq.status === 'In Progress'
                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                          : inq.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      <option value="New">🟡 New</option>
                      <option value="Contacted">🔵 Contacted</option>
                      <option value="In Progress">🟣 In Progress</option>
                      <option value="Completed">🟢 Completed</option>
                      <option value="Closed">⚪ Closed</option>
                    </select>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {inq.createdAt ? new Date(inq.createdAt).toLocaleString() : ''}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-700">
                  <p>
                    Target Vehicle:{' '}
                    <strong className="text-amber-800 font-extrabold text-sm">{inq.vehicleName}</strong>
                  </p>
                  <p className="font-mono text-slate-500">
                    Client Contact: <strong className="text-slate-800">{inq.phone}</strong> | Target Budget:{' '}
                    <strong className="text-amber-900 font-extrabold">{inq.budget ? formatCurrency(inq.budget) : 'Not specified'}</strong>
                  </p>
                  <p className="font-mono text-slate-500">
                    Purchase Urgency: <strong className="text-slate-800">{inq.readyToBuy || 'Immediate'}</strong> | Payment:{' '}
                    <strong className="text-slate-800">{inq.paymentMethod || 'Outright Cash'}</strong>
                  </p>
                  {inq.message && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600 mt-2">
                      <span className="font-bold text-slate-800 block text-[10px] uppercase font-mono">Message:</span>
                      <p>{inq.message}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                      `Hello ${inq.name}, this is Tobor Jite from Jite Auto Deals regarding your inquiry on the ${inq.vehicleName}. I'd be happy to share details and coordinate inspection.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp Buyer</span>
                  </a>

                  <a
                    href={`tel:+${cleanPhone}`}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors border border-slate-200 inline-flex items-center gap-1"
                  >
                    <Phone size={13} />
                    <span>Call</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
