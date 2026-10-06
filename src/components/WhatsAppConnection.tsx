import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, LockKeyhole, QrCode, RefreshCw, ShieldCheck, Smartphone, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';

type Provider = 'meta_cloud' | 'qr_provider';

type Connection = {
  id: string;
  provider: Provider;
  status: 'disconnected' | 'pending' | 'connected' | 'error';
  display_name?: string | null;
  phone_number?: string | null;
  phone_number_id?: string | null;
  waba_id?: string | null;
  last_error?: string | null;
  connected_at?: string | null;
  updated_at?: string | null;
};

export default function WhatsAppConnection() {
  const [ownerId, setOwnerId] = useState('');
  const [phone, setPhone] = useState('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qrMode, setQrMode] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setOwnerId(user.id);
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .select('id,provider,status,display_name,phone_number,phone_number_id,waba_id,last_error,connected_at,updated_at')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) toast.error(error.message);
    setConnection((data || null) as Connection | null);
    if (data?.phone_number) setPhone(data.phone_number);
    setQrMode(data?.provider === 'qr_provider');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const prepareConnection = async (provider: Provider) => {
    if (!ownerId) return;
    setBusy(true);
    const normalized = phone.replace(/[^0-9+]/g, '');
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .upsert({
        owner_id: ownerId,
        provider,
        status: 'pending',
        phone_number: normalized || null,
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_id' })
      .select('id,provider,status,display_name,phone_number,phone_number_id,waba_id,last_error,connected_at,updated_at')
      .single();

    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    setConnection(data as Connection);
    setQrMode(provider === 'qr_provider');

    const { error: fnError } = await supabase.functions.invoke('whatsapp-connect', {
      body: { action: 'prepare', provider },
    });
    if (fnError) console.warn('whatsapp-connect:', fnError.message);

    if (provider === 'meta_cloud') {
      toast.success('Conexão oficial preparada. Falta autorizar a conta Meta no backend.');
    } else {
      toast.success('Modo QR preparado. O QR aparecerá aqui quando um provedor de sessão for conectado.');
    }
    setBusy(false);
  };

  const disconnect = async () => {
    if (!connection) return;
    setBusy(true);
    const { error } = await supabase
      .from('whatsapp_connections')
      .update({
        status: 'disconnected',
        phone_number_id: null,
        waba_id: null,
        connected_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('WhatsApp desconectado.');
    load();
  };

  if (loading) return <div className="premium-card p-6 text-slate-500">Carregando conexão do WhatsApp...</div>;

  const connected = connection?.status === 'connected';
  const pending = connection?.status === 'pending';

  return (
    <section className="premium-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone size={22} className="text-emerald-600" />
            <h3 className="text-xl font-bold text-slate-900">Conexão do WhatsApp</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">Cada usuário conecta o próprio número. Credenciais sensíveis não ficam expostas no navegador.</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${connected ? 'bg-emerald-100 text-emerald-700' : pending ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
          {connected ? '● Conectado' : pending ? '● Aguardando conexão' : '● Não conectado'}
        </div>
      </div>

      {connected ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm"><CheckCircle2 className="text-emerald-600" /></div>
            <div>
              <p className="font-bold text-slate-900">{connection?.display_name || 'WhatsApp Business'}</p>
              <p className="text-sm text-slate-600">{connection?.phone_number || 'Número conectado'}</p>
            </div>
          </div>
          <button disabled={busy} onClick={disconnect} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2 justify-center"><Unplug size={17}/>Desconectar</button>
        </div>
      ) : (
        <>
          <div>
            <label className="text-sm font-semibold text-slate-700">Número que será conectado</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex.: +55 94 99999-9999" className="mt-2 w-full border rounded-xl px-4 py-3 outline-none focus:border-brand-500" />
            <p className="text-xs text-slate-500 mt-2">No fluxo oficial o número é confirmado pela Meta. No QR, o número real é identificado pela sessão escaneada.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <button disabled={busy} onClick={() => prepareConnection('meta_cloud')} className="text-left border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl p-5 transition-all bg-emerald-50/50">
              <div className="flex items-center justify-between"><ShieldCheck className="text-emerald-600"/><span className="text-[11px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Recomendado</span></div>
              <p className="font-bold text-slate-900 mt-3">Meta oficial</p>
              <p className="text-sm text-slate-600 mt-1">Mais estável para automações, templates e operação comercial.</p>
              <div className="mt-4 text-sm font-semibold text-emerald-700 flex items-center gap-1">Preparar conexão <ExternalLink size={15}/></div>
            </button>

            <button disabled={busy} onClick={() => prepareConnection('qr_provider')} className="text-left border-2 border-slate-200 hover:border-slate-400 rounded-2xl p-5 transition-all bg-white">
              <div className="flex items-center justify-between"><QrCode className="text-slate-700"/><span className="text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Via provedor</span></div>
              <p className="font-bold text-slate-900 mt-3">Conectar por QR</p>
              <p className="text-sm text-slate-600 mt-1">Experiência parecida com WhatsApp Web/Next Fit, desde que exista um provedor seguro gerando a sessão.</p>
              <div className="mt-4 text-sm font-semibold text-slate-700 flex items-center gap-1">Preparar QR <QrCode size={15}/></div>
            </button>
          </div>

          {pending && qrMode && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="w-44 h-44 mx-auto bg-white border rounded-2xl flex items-center justify-center shadow-sm">
                <QrCode size={84} className="text-slate-300" />
              </div>
              <p className="font-semibold text-slate-800 mt-4">QR preparado, mas ainda sem sessão real</p>
              <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">Para exibir um QR válido precisamos ligar um provedor de sessão no backend. Não vou gerar um QR falso nem expor cookies/token no navegador.</p>
              <button onClick={load} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border font-semibold text-sm"><RefreshCw size={16}/>Atualizar status</button>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-4"><LockKeyhole size={18} className="mb-2 text-slate-700"/><p className="font-semibold">Tokens no servidor</p><p className="text-slate-500 mt-1">Nada de access token em localStorage ou no código público.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><ShieldCheck size={18} className="mb-2 text-slate-700"/><p className="font-semibold">Separado por usuário</p><p className="text-slate-500 mt-1">RLS impede um cliente de ver a conexão de outro.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><RefreshCw size={18} className="mb-2 text-slate-700"/><p className="font-semibold">Revogável</p><p className="text-slate-500 mt-1">A conexão pode ser desconectada e renovada sem alterar seus leads.</p></div>
      </div>
    </section>
  );
}
