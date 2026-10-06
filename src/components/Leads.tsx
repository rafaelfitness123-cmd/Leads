import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  LayoutGrid, 
  List as ListIcon, 
  Columns as KanbanIcon,
  Instagram,
  ExternalLink,
  Copy,
  MoreHorizontal,
  Star,
  MapPin,
  Users as UsersIcon,
  ChevronRight,
  X,
  MessageSquare,
  History,
  Tag,
  Calendar,
  Edit2,
  Trash2,
  Plus,
  TrendingUp,
  Info
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, orderBy, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { motion, AnimatePresence } from 'framer-motion';
import { Lead, LeadStatus } from '../types';
import { cn, formatFollowers } from '../lib/utils';
import { toast } from 'sonner';

interface LeadsProps {
  boardId?: string | null;
  onClearBoard?: () => void;
}

export default function Leads({ boardId, onClearBoard }: LeadsProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'kanban'>('list');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [boardName, setBoardName] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    let q = query(
      collection(db, 'leads'),
      where('ownerId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    if (boardId) {
      q = query(
        collection(db, 'leads'),
        where('ownerId', '==', auth.currentUser.uid),
        where('boardId', '==', boardId),
        orderBy('createdAt', 'desc')
      );

      // Fetch board name
      getDoc(doc(db, 'boards', boardId)).then(snap => {
        if (snap.exists()) setBoardName(snap.data().name);
      });
    } else {
      setBoardName(null);
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      setLeads(leadsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
      toast.error('Erro ao carregar leads.');
    });

    return () => unsubscribe();
  }, [boardId]);

  const handleToggleFavorite = async (lead: Lead) => {
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        isFavorite: !lead.isFavorite
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}`);
    }
  };

  const handleUpdateStatus = async (leadId: string, status: LeadStatus) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), { status });
      toast.success(`Status atualizado para ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${leadId}`);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Excluir este lead permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'leads', leadId));
      setSelectedLead(null);
      toast.success('Lead removido.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leads/${leadId}`);
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.instagramHandle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyMessage = (lead: Lead) => {
    if (!lead.assignedMessage) {
      toast.error('Nenhuma mensagem vinculada a este lead.');
      return;
    }

    let message = lead.assignedMessage;
    message = message.replace(/{nome}/g, lead.name || '');
    message = message.replace(/{cidade}/g, lead.city || '');
    message = message.replace(/{instagram}/g, `@${lead.instagramHandle}`);
    message = message.replace(/{niche}/g, boardName || '');

    navigator.clipboard.writeText(message);
    toast.success('Mensagem personalizada copiada!');
  };

  const statusColors: Record<LeadStatus, string> = {
    new: 'bg-blue-100 text-blue-700',
    qualified: 'bg-indigo-100 text-indigo-700',
    contacted: 'bg-amber-100 text-amber-700',
    responded: 'bg-emerald-100 text-emerald-700',
    interested: 'bg-rose-100 text-rose-700',
    proposal: 'bg-purple-100 text-purple-700',
    closed: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-3xl font-bold text-slate-900">Leads</h2>
            {boardName && (
              <div className="flex items-center gap-2">
                <ChevronRight size={20} className="text-slate-300" />
                <span className="px-3 py-1 bg-brand-50 text-brand-700 rounded-lg text-sm font-bold flex items-center gap-2">
                  {boardName}
                  <button onClick={onClearBoard} className="hover:text-brand-900">
                    <X size={14} />
                  </button>
                </span>
              </div>
            )}
          </div>
          <p className="text-slate-500">
            {boardId ? `Visualizando leads do quadro "${boardName}"` : 'Gerencie e acompanhe o progresso de todos os seus leads.'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setViewMode('list')}
            className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-brand-50 text-brand-600" : "text-slate-400 hover:text-slate-600")}
          >
            <ListIcon size={18} />
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-brand-50 text-brand-600" : "text-slate-400 hover:text-slate-600")}
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            onClick={() => setViewMode('kanban')}
            className={cn("p-2 rounded-lg transition-all", viewMode === 'kanban' ? "bg-brand-50 text-brand-600" : "text-slate-400 hover:text-slate-600")}
          >
            <KanbanIcon size={18} />
          </button>
        </div>
      </header>

      {/* Filters & Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Filtrar por nome, @ ou cidade..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
          <Filter size={18} />
          Filtros
        </button>
      </div>

      {/* Leads Content */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {viewMode === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seguidores</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cidade</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredLeads.map((lead) => (
                      <tr 
                        key={lead.id} 
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleFavorite(lead); }}
                              className={cn("transition-colors", lead.isFavorite ? "text-amber-400" : "text-slate-200 hover:text-amber-200")}
                            >
                              <Star size={16} fill={lead.isFavorite ? "currentColor" : "none"} />
                            </button>
                            <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 shrink-0">
                              <Instagram size={20} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{lead.name || 'Sem nome'}</p>
                              <p className="text-xs font-semibold text-brand-600 font-mono">@{lead.instagramHandle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", statusColors[lead.status])}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                          {formatFollowers(lead.followersCount || 0)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {lead.city || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full", lead.score > 7 ? "bg-emerald-500" : lead.score > 4 ? "bg-amber-500" : "bg-slate-400")} 
                                style={{ width: `${(lead.score / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-400">{lead.score}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCopyMessage(lead); }}
                              className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                              title="Copiar Mensagem"
                            >
                              <Copy size={16} />
                            </button>
                            <a 
                              href={lead.instagramUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                            >
                              <ExternalLink size={16} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {viewMode === 'grid' && (
            <motion.div 
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {filteredLeads.map((lead) => (
                <motion.div 
                  key={lead.id}
                  layout
                  onClick={() => setSelectedLead(lead)}
                  className="premium-card p-5 group hover:border-brand-300 transition-all cursor-pointer relative"
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite(lead); }}
                    className={cn("absolute top-4 right-4 transition-colors", lead.isFavorite ? "text-amber-400" : "text-slate-200 hover:text-amber-200")}
                  >
                    <Star size={18} fill={lead.isFavorite ? "currentColor" : "none"} />
                  </button>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                      <Instagram size={24} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{lead.name || 'Sem nome'}</h4>
                      <p className="text-sm font-semibold text-brand-600 font-mono">@{lead.instagramHandle}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase">Status</span>
                      <span className={cn("px-2 py-0.5 rounded-lg font-bold uppercase", statusColors[lead.status])}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase">Seguidores</span>
                      <span className="text-slate-900 font-bold">{formatFollowers(lead.followersCount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold uppercase">Cidade</span>
                      <span className="text-slate-900 font-bold truncate max-w-[120px]">{lead.city || '—'}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", lead.score > 7 ? "bg-emerald-500" : lead.score > 4 ? "bg-amber-500" : "bg-slate-400")} 
                          style={{ width: `${(lead.score / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-400">{lead.score}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {viewMode === 'kanban' && (
            <motion.div 
              key="kanban"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-6 overflow-x-auto pb-6 h-full min-h-[500px]"
            >
              {(['new', 'qualified', 'contacted', 'responded', 'interested', 'proposal', 'closed'] as LeadStatus[]).map((status) => (
                <div key={status} className="w-80 shrink-0 flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 capitalize">{status}</h3>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-full">
                        {filteredLeads.filter(l => l.status === status).length}
                      </span>
                    </div>
                    <button className="p-1 text-slate-400 hover:text-slate-600">
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                    {filteredLeads.filter(l => l.status === status).map((lead) => (
                      <motion.div 
                        key={lead.id}
                        layoutId={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="premium-card p-4 group hover:border-brand-300 transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
                            <Instagram size={16} />
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(lead); }}
                            className={cn("transition-colors", lead.isFavorite ? "text-amber-400" : "text-slate-200 hover:text-amber-200")}
                          >
                            <Star size={14} fill={lead.isFavorite ? "currentColor" : "none"} />
                          </button>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 truncate mb-1">{lead.name || 'Sem nome'}</h4>
                        <p className="text-xs font-semibold text-brand-600 font-mono mb-3">@{lead.instagramHandle}</p>
                        
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
                          <span>{formatFollowers(lead.followersCount || 0)} seg.</span>
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full", lead.score > 7 ? "bg-emerald-500" : lead.score > 4 ? "bg-amber-500" : "bg-slate-400")} 
                                style={{ width: `${(lead.score / 10) * 100}%` }}
                              />
                            </div>
                            <span>{lead.score}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lead Details Drawer */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLead(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600">
                    <Instagram size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Detalhes do Lead</h3>
                    <p className="text-xs text-slate-500">ID: {selectedLead.id.substring(0, 8)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLead(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Profile Info */}
                <div className="text-center">
                  <div className="w-24 h-24 bg-slate-100 rounded-3xl mx-auto mb-4 flex items-center justify-center text-slate-300 border-4 border-white shadow-xl">
                    <Instagram size={48} />
                  </div>
                  <h4 className="text-2xl font-bold text-slate-900">{selectedLead.name || 'Sem nome'}</h4>
                  <p className="text-brand-600 font-mono font-bold mb-4">@{selectedLead.instagramHandle}</p>
                  
                  <div className="flex items-center justify-center gap-2">
                    <a 
                      href={`https://instagram.com/${selectedLead.instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                    >
                      <ExternalLink size={16} />
                      Abrir Instagram
                    </a>
                    <button className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all">
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Seguidores</p>
                    <p className="text-sm font-bold text-slate-900">{formatFollowers(selectedLead.followersCount || 0)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Score</p>
                    <p className="text-sm font-bold text-slate-900">{selectedLead.score}/10</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Status</p>
                    <p className={cn("text-[10px] font-bold uppercase", statusColors[selectedLead.status].split(' ')[1])}>
                      {selectedLead.status}
                    </p>
                  </div>
                </div>

                {/* Status Selector */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                    <TrendingUp size={14} />
                    Mudar Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['new', 'qualified', 'contacted', 'responded', 'interested', 'proposal', 'closed'] as LeadStatus[]).map((status) => (
                      <button 
                        key={status}
                        onClick={() => handleUpdateStatus(selectedLead.id, status)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all border",
                          selectedLead.status === status 
                            ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-100" 
                            : "bg-white text-slate-500 border-slate-200 hover:border-brand-300 hover:text-brand-600"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bio & Details */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <MapPin size={14} />
                      Cidade
                    </label>
                    <p className="text-sm text-slate-900 font-medium">{selectedLead.city || 'Não informada'}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Info size={14} />
                      Bio
                    </label>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl italic">
                      {selectedLead.bio || 'Sem biografia detectada.'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => handleCopyMessage(selectedLead)}
                    className="w-full py-3 bg-brand-50 text-brand-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-100 transition-all"
                  >
                    <MessageSquare size={18} />
                    Copiar Mensagem de Prospecção
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                      <Calendar size={16} />
                      Follow-up
                    </button>
                    <button className="py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                      <Tag size={16} />
                      Tags
                    </button>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-8 flex items-center justify-between">
                  <button 
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="text-xs text-red-400 font-bold uppercase hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Excluir Lead
                  </button>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    Importado em {selectedLead.createdAt.toDate().toLocaleDateString()}
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
