import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, MessageSquare, Pause, Play, Plus, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';

interface Board { id: string; name: string; }
interface Template { id: string; name: string; meta_template_name: string; language: string; body_preview?: string | null; }
interface Automation { id: string; name: string; status: string; starts_at: string; interval_minutes: number; max_per_day: number; board_id?: string | null; }
interface Lead { id: string; name?: string | null; phone?: string | null; whatsapp_allowed: boolean; whatsapp_consent_source?: string | null; }

function nextSlot(current: Date, dailyStart: number, dailyEnd: number, maxPerDay: number, sentToday: number) {
  const d = new Date(current);
  const start = new Date(d); start.setHours(dailyStart, 0, 0, 0);
  const end = new Date(d); end.setHours(dailyEnd, 0, 0, 0);
  if (d < start) return { date: start, sentToday: 0 };
  if (d >= end || sentToday >= maxPerDay) {
    const tomorrow = new Date(d); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(dailyStart, 0, 0, 0);
    return { date: tomorrow, sentToday: 0 };
  }
  return { date: d, sentToday };
}

export default function Automations() {
  const [ownerId, setOwnerId] = useState('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedBoard, setSelectedBoard] = useState('');
  const [templateForm, setTemplateForm] = useState({ name: '', metaName: '', language: 'pt_BR', preview: '' });
  const [automationForm, setAutomationForm] = useState({ name: 'Sequência de prospecção', templateId: '', startAt: '', interval: 20, maxPerDay: 12 });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setOwnerId(user.id);
    const [{ data: b }, { data: t }, { data: a }] = await Promise.all([
      supabase.from('boards').select('id,name').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('whatsapp_templates').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('whatsapp_automations').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    ]);
    setBoards((b || []) as Board[]);
    setTemplates((t || []) as Template[]);
    setAutomations((a || []) as Automation[]);
    if (!selectedBoard && b?.[0]?.id) setSelectedBoard(b[0].id);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!ownerId || !selectedBoard) { setLeads([]); return; }
    supabase.from('leads').select('id,name,phone,whatsapp_allowed,whatsapp_consent_source').eq('owner_id', ownerId).eq('board_id', selectedBoard).order('score', { ascending: false })
      .then(({ data }) => setLeads((data || []) as Lead[]));
  }, [ownerId, selectedBoard]);

  const withPhone = useMemo(() => leads.filter(l => l.phone), [leads]);
  const allowed = useMemo(() => withPhone.filter(l => l.whatsapp_allowed), [withPhone]);
  const blocked = withPhone.length - allowed.length;

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.metaName) return toast.error('Informe o nome e o nome do template aprovado na Meta.');
    const { error } = await supabase.from('whatsapp_templates').insert({ owner_id: ownerId, name: templateForm.name, meta_template_name: templateForm.metaName.trim(), language: templateForm.language, body_preview: templateForm.preview, is_active: true });
    if (error) return toast.error(error.message);
    toast.success('Template salvo.');
    setTemplateForm({ name: '', metaName: '', language: 'pt_BR', preview: '' });
    refresh();
  };

  const setLeadPermission = async (lead: Lead, value: boolean) => {
    const { error } = await supabase.from('leads').update({
      whatsapp_allowed: value,
      whatsapp_allowed_at: value ? new Date().toISOString() : null,
      whatsapp_consent_source: value ? (lead.whatsapp_consent_source || 'confirmado_manualmente') : null,
    }).eq('id', lead.id);
    if (error) return toast.error(error.message);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, whatsapp_allowed: value } : l));
  };

  const createAutomation = async () => {
    if (!selectedBoard || !automationForm.templateId || !automationForm.startAt) return toast.error('Escolha quadro, template e horário inicial.');
    if (!allowed.length) return toast.error('Nenhum contato autorizado com telefone neste quadro.');
    const tpl = templates.find(t => t.id === automationForm.templateId)!;
    const startsAt = new Date(automationForm.startAt);
    const { data: automation, error } = await supabase.from('whatsapp_automations').insert({
      owner_id: ownerId,
      name: automationForm.name,
      board_id: selectedBoard,
      template_id: automationForm.templateId,
      starts_at: startsAt.toISOString(),
      interval_minutes: Number(automationForm.interval),
      max_per_day: Number(automationForm.maxPerDay),
      daily_start: '09:00',
      daily_end: '18:00',
      status: 'active',
    }).select('*').single();
    if (error || !automation) return toast.error(error?.message || 'Não foi possível criar a automação.');

    let cursor = new Date(startsAt);
    let sentToday = 0;
    const jobs = allowed.map((lead) => {
      const slot = nextSlot(cursor, 9, 18, Number(automationForm.maxPerDay), sentToday);
      cursor = slot.date;
      sentToday = slot.sentToday + 1;
      const scheduled = new Date(cursor);
      cursor = new Date(cursor.getTime() + Number(automationForm.interval) * 60_000);
      return {
        owner_id: ownerId,
        automation_id: automation.id,
        lead_id: lead.id,
        phone: lead.phone,
        template_name: tpl.meta_template_name,
        language: tpl.language,
        parameters: [lead.name || ''],
        scheduled_at: scheduled.toISOString(),
        status: 'pending',
      };
    });
    const { error: queueError } = await supabase.from('whatsapp_queue').insert(jobs);
    if (queueError) return toast.error(queueError.message);
    toast.success(`${jobs.length} mensagens colocadas na programação.`);
    refresh();
  };

  const changeStatus = async (id: string, status: 'active' | 'paused') => {
    const { error } = await supabase.from('whatsapp_automations').update({ status }).eq('id', id);
    if (error) return toast.error(error.message);
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  if (loading) return <div className="p-8 text-slate-500">Carregando automações...</div>;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-900">Automações WhatsApp</h2>
        <p className="text-slate-500 mt-1">Crie sequências em horários diferentes, com limite diário e intervalo entre contatos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="premium-card p-5"><Users className="text-brand-600 mb-3"/><p className="text-sm text-slate-500">Com telefone</p><p className="text-2xl font-bold">{withPhone.length}</p></div>
        <div className="premium-card p-5"><ShieldCheck className="text-emerald-600 mb-3"/><p className="text-sm text-slate-500">Autorizados</p><p className="text-2xl font-bold">{allowed.length}</p></div>
        <div className="premium-card p-5"><Pause className="text-amber-600 mb-3"/><p className="text-sm text-slate-500">Aguardando autorização</p><p className="text-2xl font-bold">{blocked}</p></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="premium-card p-6 space-y-4">
          <div className="flex items-center gap-2"><MessageSquare size={20}/><h3 className="font-bold text-lg">Template oficial</h3></div>
          <input value={templateForm.name} onChange={e=>setTemplateForm({...templateForm,name:e.target.value})} placeholder="Nome interno: Ex. Prospecção condomínio" className="w-full border rounded-xl px-4 py-3" />
          <input value={templateForm.metaName} onChange={e=>setTemplateForm({...templateForm,metaName:e.target.value})} placeholder="Nome aprovado na Meta: ex. proposta_condominio" className="w-full border rounded-xl px-4 py-3" />
          <div className="grid grid-cols-3 gap-3"><input value={templateForm.language} onChange={e=>setTemplateForm({...templateForm,language:e.target.value})} className="border rounded-xl px-4 py-3"/><textarea value={templateForm.preview} onChange={e=>setTemplateForm({...templateForm,preview:e.target.value})} placeholder="Prévia da mensagem" className="col-span-2 border rounded-xl px-4 py-3 min-h-24" /></div>
          <button onClick={saveTemplate} className="bg-slate-900 text-white rounded-xl px-4 py-3 font-semibold flex items-center gap-2"><Plus size={18}/>Salvar template</button>
        </section>

        <section className="premium-card p-6 space-y-4">
          <div className="flex items-center gap-2"><CalendarClock size={20}/><h3 className="font-bold text-lg">Nova programação</h3></div>
          <select value={selectedBoard} onChange={e=>setSelectedBoard(e.target.value)} className="w-full border rounded-xl px-4 py-3"><option value="">Escolha o quadro</option>{boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select value={automationForm.templateId} onChange={e=>setAutomationForm({...automationForm,templateId:e.target.value})} className="w-full border rounded-xl px-4 py-3"><option value="">Escolha o template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <input value={automationForm.name} onChange={e=>setAutomationForm({...automationForm,name:e.target.value})} className="w-full border rounded-xl px-4 py-3"/>
          <div className="grid grid-cols-3 gap-3">
            <input type="datetime-local" value={automationForm.startAt} onChange={e=>setAutomationForm({...automationForm,startAt:e.target.value})} className="border rounded-xl px-3 py-3"/>
            <input type="number" min="1" value={automationForm.interval} onChange={e=>setAutomationForm({...automationForm,interval:Number(e.target.value)})} className="border rounded-xl px-3 py-3" title="Intervalo em minutos"/>
            <input type="number" min="1" value={automationForm.maxPerDay} onChange={e=>setAutomationForm({...automationForm,maxPerDay:Number(e.target.value)})} className="border rounded-xl px-3 py-3" title="Máximo por dia"/>
          </div>
          <p className="text-xs text-slate-500">Janela padrão: 09:00–18:00. Só entram na fila contatos com telefone e autorização marcada.</p>
          <button onClick={createAutomation} className="bg-brand-600 text-white rounded-xl px-4 py-3 font-semibold flex items-center gap-2"><Play size={18}/>Criar programação</button>
        </section>
      </div>

      <section className="premium-card p-6">
        <div className="flex items-center justify-between mb-4"><div><h3 className="font-bold text-lg">Contatos do quadro</h3><p className="text-sm text-slate-500">Marque somente quando houver autorização ou uma base legítima para mensagem pelo WhatsApp Business.</p></div></div>
        <div className="divide-y">
          {leads.map(lead => <div key={lead.id} className="py-3 flex items-center justify-between gap-4"><div><p className="font-semibold text-slate-900">{lead.name || 'Sem nome'}</p><p className="text-sm text-slate-500">{lead.phone || 'Sem telefone cadastrado'}</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!lead.phone} checked={Boolean(lead.whatsapp_allowed)} onChange={e=>setLeadPermission(lead,e.target.checked)}/><span>{lead.whatsapp_allowed ? 'Autorizado' : 'Não autorizado'}</span></label></div>)}
        </div>
      </section>

      <section className="premium-card p-6">
        <h3 className="font-bold text-lg mb-4">Programações</h3>
        <div className="space-y-3">{automations.length === 0 ? <p className="text-slate-500">Nenhuma programação criada.</p> : automations.map(a => <div key={a.id} className="border rounded-xl p-4 flex items-center justify-between"><div><p className="font-semibold">{a.name}</p><p className="text-xs text-slate-500">Início {new Date(a.starts_at).toLocaleString('pt-BR')} • {a.interval_minutes} min • máx. {a.max_per_day}/dia</p></div><button onClick={()=>changeStatus(a.id,a.status==='active'?'paused':'active')} className="px-3 py-2 rounded-lg bg-slate-100 flex items-center gap-2">{a.status==='active'?<><Pause size={16}/>Pausar</>:<><Play size={16}/>Ativar</>}</button></div>)}</div>
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <div className="font-semibold flex gap-2 items-center"><Clock3 size={17}/>Envio externo</div>
        <p className="mt-1">A agenda e a fila já ficam no Supabase. Para o disparo real, ainda é necessário conectar as credenciais da WhatsApp Business Platform e os templates aprovados pela Meta no backend.</p>
      </div>
    </div>
  );
}
