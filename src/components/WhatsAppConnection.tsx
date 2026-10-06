import React, { useEffect, useMemo, useState } from 'react';
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

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`;
  return digits ? `+${digits}` : '';
}

function isValidBrazilPhone(value: string) {
  const normalized = normalizePhone(value);
  return /^\+55\d{10,11}$/.test(normalized);
}

function displayPhone(value: string) {
  const digits = normalizePhone(value).replace(/\D/g, '');
  if (!digits.startsWith('55')) return value;
  const local = digits.slice(2);
  if (local.length === 11) return `+55 (${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return normalizePhone(value);
}

export default function WhatsAppConnection() {
  const [ownerId, setOwnerId] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneValidated, setPhoneValidated] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qrMode, setQrMode] = useState(false);

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneIsValid = useMemo(() => isValidBrazilPhone(phone), [phone]);

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
    if (data?.phone_number) {
      setPhone(data.phone_number);
      setPhoneValidated(isValidBrazilPhone(data.phone_number));
    }
    setQrMode(data?.provider === 'qr_provider');
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const validatePhone = () => {
    if (!phone.trim()) return toast.error('Digite o número do WhatsApp.');
    if (!phoneIsValid) {
      setPhoneValidated(false);
      return toast.error('Número inválido. Use DDD + número, por exemplo: 94 99999-9999.');
    }
    setPhone(normalizedPhone);
    setPhoneValidated(true);
    toast.success(`Número válido: ${displayPhone(normalizedPhone)}. Agora escolha como conectar.`);
  };

  const prepareConnection = async (provider: Provider) => {
    if (!ownerId) return;
    if (!phoneValidated || !phoneIsValid) {
      toast.error('Primeiro valide o número.');
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .upsert({
        owner_id: ownerId,
        provider,
        status: 'pending',
        phone_number: normalizedPhone,
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

    const { data: fnData, error: fnError } = await supabase.functions.invoke('whatsapp-connect', {
      body: { action: 'prepare', provider, phone: normalizedPhone },
    });

    if (fnError) console.warn('whatsapp-connect:', fnError.message);

    if (provider === 'meta_cloud') {
      toast.success('Número salvo. A próxima confirmação será feita pela Meta.');
    } else {
      toast.success('Número salvo. O QR real aparecerá quando o provedor de sessão estiver conectado.');
    }
    if (fnData?.message) console.info(fnData.message);
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
    setPhoneValidated(false);
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
          {connected ? '● Conectado' : pending ? '● Aguardando confirmação' : '● Não conectado'}
        </div>
      </div>

      {connected ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm"><CheckCircle2 className="text-emerald-600" /></div>
            <div>
              <p className="font-bold text-slate-900">{connection?.display_name || 'WhatsApp Business'}</p>
              <p className="text-sm text-slate-600">{displayPhone(connection?.phone_number || '') || 'Número conectado'}</p>
            </div>
          </div>
          <button disabled={busy} onClick={disconnect} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2 justify-center"><Unplug size={17}/>Desconectar</button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white">
            <div className="flex items-center gap-2 mb-1"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">1</span><h4 className="font-bold text-slate-900">Informe e valide o número</h4></div>
            <label className="text-sm font-semibold text-slate-700 mt-4 block">Número que será conectado</label>
            <div className="mt-2 flex flex-col md:flex-row gap-3">
              <input
                value={phone}
                onChange={e => { setPhone(e.target.value); setPhoneValidated(false); }}
                placeholder="Ex.: 94 99999-9999"
                className={`flex-1 border rounded-xl px-4 py-3 outline-none ${phoneValidated ? 'border-emerald-400 bg-emerald-50/30' : 'focus:border-brand-500'}`}
              />
              <button
                disabled={busy}
                onClick={validatePhone}
                className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {phoneValidated ? <CheckCircle2 size={18}/> : <Smartphone size={18}/>} {phoneValidated ? 'Número validado' : 'Validar e continuar'}
              </button>
            </div>
            {phoneValidated ? (
              <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={17}/><span><strong>{displayPhone(normalizedPhone)}</strong> está com formato válido. A posse do número será confirmada na próxima etapa.</span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2">Pode digitar só DDD + número. O sistema adiciona +55 automaticamente.</p>
            )}
          </div>

          {phoneValidated && (
            <div className="space-y-3">
              <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">2</span><h4 className="font-bold text-slate-900">Escolha como confirmar e conectar</h4></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border-2 border-emerald-200 rounded-2xl p-5 bg-emerald-50/50">
                  <div className="flex items-center justify-between"><ShieldCheck className="text-emerald-600"/><span className="text-[11px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Recomendado</span></div>
                  <p className="font-bold text-slate-900 mt-3">Meta oficial</p>
                  <p className="text-sm text-slate-600 mt-1">Mais estável para automações, templates e operação comercial.</p>
                  <button disabled={busy} onClick={() => prepareConnection('meta_cloud')} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
                    <ExternalLink size={17}/> Continuar com Meta
                  </button>
                </div>

                <div className="border-2 border-slate-200 rounded-2xl p-5 bg-white">
                  <div className="flex items-center justify-between"><QrCode className="text-slate-700"/><span className="text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Via provedor</span></div>
                  <p className="font-bold text-slate-900 mt-3">Conectar por QR</p>
                  <p className="text-sm text-slate-600 mt-1">Experiência parecida com WhatsApp Web/Next Fit, usando um provedor seguro de sessão.</p>
                  <button disabled={busy} onClick={() => prepareConnection('qr_provider')} className="mt-4 w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
                    <QrCode size={17}/> Gerar QR de conexão
                  </button>
                </div>
              </div>
            </div>
          )}

          {pending && !qrMode && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-bold text-amber-900">Etapa Meta preparada</p>
              <p className="text-sm text-amber-800 mt-1">O número foi salvo, mas ainda não está conectado. Para a confirmação real de posse precisamos finalizar o Embedded Signup da Meta no backend do Horizon. Até isso estar configurado, nenhuma mensagem será enviada.</p>
            </div>
          )}

          {pending && qrMode && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="w-44 h-44 mx-auto bg-white border rounded-2xl flex items-center justify-center shadow-sm">
                <QrCode size={84} className="text-slate-300" />
              </div>
              <p className="font-semibold text-slate-800 mt-4">Aguardando QR real do provedor</p>
              <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">O número está preparado. O QR só será exibido quando ligarmos um provedor que mantenha a sessão no servidor; não geramos QR falso nem expomos cookies/tokens no navegador.</p>
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
