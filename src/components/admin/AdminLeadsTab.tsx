import React, { useState } from 'react';
import { Users, Phone, MessageSquare, ExternalLink, FileSpreadsheet, CheckCircle2, Search, Filter } from 'lucide-react';
import { Lead, LeadStatus } from '../../types';
import {
  formatCurrency,
  updateLead,
  saveLeadStatus,
} from '../../utils';

interface AdminLeadsTabProps {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
}

export default function AdminLeadsTab({ leads, setLeads }: AdminLeadsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'find_car' | 'source_car'>('All');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // Update Lead Status
  const handleUpdateStatus = async (id: string, newStatus: LeadStatus) => {
    const updated = updateLead(id, { status: newStatus });
    setLeads(updated);
    try {
      await saveLeadStatus(id, newStatus);
    } catch (e) {
      console.warn('Status updated in local cache, syncing to Firestore:', e);
    }
  };

  // Update Lead Notes
  const handleUpdateNotes = (id: string, notes: string) => {
    const updated = updateLead(id, { notes });
    setLeads(updated);
  };

  // Export Leads to CSV
  const handleExportCSV = () => {
    if (leads.length === 0) {
      alert('No consultation leads available to export yet!');
      return;
    }
    const headers = [
      'ID',
      'Name',
      'Phone',
      'Type',
      'Brand',
      'Model',
      'Body Type',
      'Budget (NGN)',
      'Location',
      'Payment Method',
      'Requirements/Notes',
      'External Listing URL',
      'Date Created',
      'Status',
    ];
    const rows = leads.map((l) => [
      l.id,
      l.name,
      l.phone,
      l.type === 'source_car' ? 'Source A Car' : 'Find My Car',
      l.brand || '',
      l.model || '',
      l.vehicleType || '',
      l.budget || 0,
      l.location || '',
      l.paymentMethod || 'Cash',
      (l.requirements || '').replace(/"/g, '""'),
      l.sourceUrl || '',
      l.createdAt || '',
      l.status || 'New',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jite_auto_deals_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !searchTerm.trim() ||
      `${lead.name} ${lead.phone} ${lead.brand} ${lead.model} ${lead.location} ${lead.requirements}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' ? true : lead.status === statusFilter;
    const matchesType = typeFilter === 'All' ? true : lead.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            <Users className="text-amber-500" size={22} />
            <span>Consultant Leads Pipeline</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Submitted requests from <strong>Find My Car</strong> (buyer consultations) and <strong>Source A Car</strong> (external vehicle verifications).
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <FileSpreadsheet size={15} className="text-amber-400" />
          <span>Export Leads CSV</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads by client name, phone, vehicle, location..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
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

          {/* Type filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 font-mono">Type:</span>
            {(['All', 'find_car', 'source_car'] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setTypeFilter(tp)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  typeFilter === tp
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tp === 'All' ? 'All Types' : tp === 'find_car' ? 'Find My Car' : 'Source A Car'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <Users size={36} className="mx-auto text-slate-300" />
          <p className="text-slate-500 text-sm font-semibold">No consultation leads matching criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLeads.map((lead) => {
            const isSourceCar = lead.type === 'source_car';
            const cleanPhone = lead.phone.replace(/\D/g, '');

            return (
              <div
                key={lead.id}
                className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-amber-300 transition-all shadow-xs space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display font-bold text-base text-slate-900">{lead.name}</span>

                    <span
                      className={`text-[10px] uppercase font-extrabold font-mono px-2.5 py-0.5 rounded-md ${
                        isSourceCar
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isSourceCar ? 'Source A Car' : 'Find My Car'}
                    </span>

                    {/* Status Dropdown */}
                    <select
                      value={lead.status || 'New'}
                      onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                      className={`text-[11px] font-bold font-mono uppercase px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                        lead.status === 'New'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : lead.status === 'Contacted'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : lead.status === 'In Progress'
                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                          : lead.status === 'Completed'
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
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : ''}
                  </span>
                </div>

                {/* Data Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold font-mono">Client Contact</span>
                    <a
                      href={`https://wa.me/${cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-slate-900 hover:text-amber-700 inline-flex items-center gap-1.5 mt-0.5"
                    >
                      <Phone size={13} className="text-emerald-600" />
                      <span>{lead.phone}</span>
                    </a>
                    {lead.location && <span className="text-slate-500 block mt-1">📍 {lead.location}</span>}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold font-mono">Vehicle Criteria</span>
                    <span className="font-semibold text-slate-900 block mt-0.5">
                      {lead.brand} {lead.model && lead.model !== lead.brand ? `• ${lead.model}` : ''}
                    </span>
                    <span className="text-slate-500 block text-[11px]">Type: {lead.vehicleType || 'Any'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold font-mono">Budget & Payment</span>
                    {lead.budget > 0 ? (
                      <span className="font-extrabold text-amber-900 block mt-0.5 font-mono">
                        {formatCurrency(lead.budget)}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic block mt-0.5">External listing valuation</span>
                    )}
                    <span className="text-slate-600 block text-[11px]">
                      Preference: {lead.paymentMethod === 'Financing' ? 'Vehicle Finance' : 'Outright Purchase'}
                    </span>
                  </div>
                </div>

                {/* Requirements / Notes */}
                {lead.requirements && (
                  <div className="text-xs bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-slate-700 space-y-1">
                    <span className="font-extrabold text-amber-950 text-[11px] block uppercase tracking-wider font-mono">
                      Client Requirements / Description:
                    </span>
                    <p className="font-medium leading-relaxed whitespace-pre-line">{lead.requirements}</p>
                  </div>
                )}

                {/* External Listing Link if present */}
                {lead.sourceUrl && (
                  <div className="text-xs flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 font-bold text-[10px] uppercase font-mono">Listing Link:</span>
                    <a
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-700 hover:text-amber-800 underline truncate max-w-xl inline-flex items-center gap-1 font-mono font-medium"
                    >
                      <ExternalLink size={12} />
                      <span className="truncate">{lead.sourceUrl}</span>
                    </a>
                  </div>
                )}

                {/* Screenshot preview if uploaded */}
                {lead.sourceImage && (
                  <div className="text-xs space-y-1.5">
                    <span className="text-slate-400 font-bold text-[10px] uppercase font-mono">Attached Screenshot:</span>
                    <div className="inline-block p-1 bg-white border border-slate-200 rounded-xl shadow-xs">
                      <img
                        src={lead.sourceImage}
                        alt="Vehicle screenshot"
                        className="h-28 w-auto max-w-xs object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedScreenshot(lead.sourceImage || null)}
                        title="Click to view full screenshot"
                      />
                    </div>
                  </div>
                )}

                {/* Internal Consultant Notes and Communication Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <div className="flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Add internal consultant notes..."
                      defaultValue={lead.notes || ''}
                      onBlur={(e) => handleUpdateNotes(lead.id, e.target.value)}
                      className="text-xs border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 w-full focus:outline-none focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                        `Hello ${lead.name}, this is Tobor Jite from Jite Auto Deals regarding your vehicle consultation request. How can I assist you today?`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare size={13} />
                      <span>WhatsApp Client</span>
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
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot Viewer Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl p-2 border border-white/20">
            <img
              src={selectedScreenshot}
              alt="Full resolution lead screenshot"
              className="max-h-[85vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
