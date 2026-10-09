import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LockKeyhole, QrCode, RefreshCw, ShieldCheck, Smartphone, Unplug, Send, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../supabase';

type Connection = {
  id: string;
  provider: 'meta_cloud' | 'qr_provider';
  status: 'disconnected' | 'pending' | 'connected' | 'error';
  display_name?: string | null;
  phone_number?: string | null;
  provider_account_id?: string | null;
  provider_base_url?: string | null;
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
  return /^\+55\d{10,11}$/.test(normalizePhone(value));
}

function displayPhone(value: string) {
  const digits = normalizePhone(value).replace(/\D/g, '');
  if (!digits.startsWith('55')) return value;
  const local = digits.slice(2);
  if (local.length === 11) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return normalizePhone(value);
}

async function invokeWhatsApp(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('whatsapp-connect', { body });
  if (error) {
    let message = error.message || 'Falha ao falar com o serviço de WhatsApp.';
    const context = (error as any).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = await context.json();
        if (payload?.error) message = payload.error;
      } catch { /* mantém a mensagem original */ }
    }
    return { ok: false, error: message };
  }
  return data || { ok: false, error: 'O servidor não retornou uma resposta.' };
}

export default function WhatsAppConnection() {
  const [ownerId, setOwnerId] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneValidated, setPhoneValidated] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [providerUrl, setProviderUrl] = useState('');
  const [providerApiKey, setProviderApiKey] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste enviada pelo Horizon.');

  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);
  const phoneIsValid = useMemo(() => isValidBrazilPhone(phone), [phone]);
  const providerConfigured = Boolean(connection?.provider_base_url);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setOwnerId(user.id);
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .select('id,provider,status,display_name,phone_number,provider_account_id,provider_base_url,last_error,connected_at,updated_at')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) toast.error(error.message);
    setConnection((data || null) as Connection | null);
    if (data?.phone_number) {
      setPhone(data.phone_number);
      setTestPhone(data.phone_number);
      setPhoneValidated(isValidBrazilPhone(data.phone_number));
    }
    if (data?.provider_base_url) setProviderUrl(data.provider_base_url);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!connection?.id || connection.status !== 'pending') return;
    const timer = window.setInterval(async () => {
      const result = await invokeWhatsApp({ action: 'status' });
      if (!result?.ok) return;
      setConnection(prev => prev ? { ...prev, status: result.status || prev.status } : prev);
      if (result.status === 'connected') {
        setQrCode('');
        setPairingCode('');
        toast.success('WhatsApp conectado com sucesso!');
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [connection?.id, connection?.status]);

  const validatePhone = () => {
    if (!phone.trim()) return toast.error('Digite o número do WhatsApp que você pretende conectar.');
    if (!phoneIsValid) {
      setPhoneValidated(false);
      return toast.error('Número inválido. Use DDD + número, por exemplo: 94 99999-9999.');
    }
    setPhone(normalizedPhone);
    setPhoneValidated(true);
    toast.success(`Número válido: ${displayPhone(normalizedPhone)}.`);
  };

  const configureProvider = async () => {
    if (!providerUrl.trim() || !providerApiKey.trim()) {
      return toast.error('Informe a URL e a chave de API do provedor QR.');
    }
    setBusy(true);
    const result = await invokeWhatsApp({
      action: 'configure',
      providerUrl: providerUrl.trim(),
      apiKey: providerApiKey.trim(),
    });
    setBusy(false);
    if (!result?.ok) return toast.error(result?.error || 'Não foi possível salvar o provedor.');
    setProviderApiKey('');
    setQrCode('');
    setPairingCode('');
    toast.success('Provedor salvo com segurança no servidor.');
    await load();
  };

  const prepareConnection = async () => {
    if (!providerConfigured) return toast.error('Configure primeiro o serviço QR e o token da instância.');
    if (!phoneValidated || !phoneIsValid) return toast.error('Valide o número antes de continuar.');
    setBusy(true);
    const result = await invokeWhatsApp({ action: 'prepare', phone: normalizedPhone });
    setBusy(false);
    if (!result?.ok) return toast.error(result?.error || 'Não foi possível iniciar a conexão.');
    setConnection(prev => prev ? {
      ...prev,
      provider: 'qr_provider',
      status: result.status || 'pending',
      phone_number: normalizedPhone,
      provider_account_id: result.instanceName || prev.provider_account_id,
      last_error: null,
    } : prev);
    setQrCode(result.qrCode || '');
    setPairingCode(result.pairingCode || '');
    setTestPhone(normalizedPhone);
    if (result.status === 'connected') {
      toast.success('Seu WhatsApp já estava conectado.');
    } else if (result.qrCode || result.pairingCode) {
      toast.success('Conexão iniciada. Autorize pelo WhatsApp no celular.');
    } else {
      toast.info(result.message || 'Aguardando confirmação no celular.');
    }
  };

  const generatePairingCode = async () => {
    if (!providerConfigured) return toast.error('Configure primeiro o serviço QR e o token da instância.');
    if (!phoneValidated || !phoneIsValid) return toast.error('Valide o número antes de continuar.');
    setBusy(true);
    const result = await invokeWhatsApp({ action: 'pair', phone: normalizedPhone });
    setBusy(false);
    if (!result?.ok) return toast.error(result?.error || 'Não foi possível gerar o código de pareamento.');
    setConnection(prev => prev ? {
      ...prev,
      provider: 'qr_provider',
      status: 'pending',
      phone_number: normalizedPhone,
      provider_account_id: result.instanceName || prev.provider_account_id,
      last_error: null,
    } : prev);
    setQrCode('');
    setPairingCode(result.pairingCode || '');
    setTestPhone(normalizedPhone);
    toast.success('Código gerado. Digite-o no WhatsApp do celular.');
  };

  const checkStatus = async () => {
    setBusy(true);
    const result = await invokeWhatsApp({ action: 'status' });
    setBusy(false);
    if (!result?.ok) return toast.error(result?.error || 'Não foi possível consultar a conexão.');
    setConnection(prev => prev ? { ...prev, status: result.status || prev.status } : prev);
    if (result.status === 'connected') {
      setQrCode('');
      setPairingCode('');
      toast.success('WhatsApp conectado!');
    } else {
      toast.info('Ainda aguardando a confirmação no celular.');
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    setBusy(true);
    const result = await invokeWhatsApp({ action: 'disconnect' });
    setBusy(false);
    if (!result?.ok) return toast.error(result?.error || 'Não foi possível desconectar.');
    setConnection(prev => prev ? { ...prev, status: 'disconnected', connected_at: null, last_error: null } : prev);
    setQrCode('');
    setPairingCode('');
    toast.success('WhatsApp desconectado.');
  };

  const sendTest = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return toast.error('Informe o número de destino e a mensagem de teste.');
    setBusy(true);
    const result = await invokeWhatsApp({ action: 'send_test', phone: testPhone, message: testMessage });
    setBusy(false);
    if (!result?.ok) return toast.error(result?.error || 'Não foi possível enviar o teste.');
    toast.success('Mensagem de teste aceita pelo provedor.');
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
            <h3 className="text-xl font-bold text-slate-900">Conexão real do WhatsApp</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">Conecte pelo QR, confira o estado da sessão e faça um envio de teste antes de ativar a programação.</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${connected ? 'bg-emerald-100 text-emerald-700' : pending ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
          {connected ? '● Conectado' : pending ? '● Aguardando confirmação' : '● Não conectado'}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5 bg-white space-y-3">
        <div className="flex items-center gap-2"><Settings2 size={19}/><h4 className="font-bold text-slate-900">1. Serviço que gera o QR</h4></div>
        <p className="text-sm text-slate-600">O Horizon usa as rotas do Evolution Go para gerar QR, consultar a sessão e enviar mensagens. A URL e o token são enviados ao backend; o token fica protegido no Supabase Vault e não volta a aparecer na tela.</p>
        <label className="text-sm font-semibold text-slate-700 block">URL base da API Evolution Go</label>
        <input
          value={providerUrl}
          onChange={e => setProviderUrl(e.target.value)}
          placeholder="https://api-do-seu-provedor.com"
          className="w-full border rounded-xl px-4 py-3 focus:border-brand-500 outline-none"
          autoComplete="url"
        />
        <label className="text-sm font-semibold text-slate-700 block">Token da instância WhatsApp</label>
        <input
          value={providerApiKey}
          onChange={e => setProviderApiKey(e.target.value)}
          placeholder={providerConfigured ? 'Token já salvo (digite apenas para substituir)' : 'Cole o token da instância aqui'}
          type="password"
          autoComplete="new-password"
          className="w-full border rounded-xl px-4 py-3 focus:border-brand-500 outline-none"
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button disabled={busy} onClick={configureProvider} className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold disabled:opacity-50">
            {busy ? 'Salvando...' : providerConfigured ? 'Salvar / atualizar provedor' : 'Salvar provedor com segurança'}
          </button>
          {providerConfigured && <span className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 size={16}/>URL salva; a chave fica protegida no servidor.</span>}
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">Ainda não tem provedor? <a href="https://go.whatsevolution.com.br/" target="_blank" rel="noreferrer" class="font-semibold underline">Teste o Evolution Go por 7 dias sem cartão</a>; depois, o plano informado pelo serviço é R$ 29,90/mês por instância. É uma API não oficial e existe risco de restrição/bloqueio do número; prefira um número dedicado e envie somente para contatos que autorizaram mensagens.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 p-5 bg-white">
        <div className="flex items-center gap-2 mb-1"><span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">2</span><h4 className="font-bold text-slate-900">Autorize seu WhatsApp</h4></div>
        <label className="text-sm font-semibold text-slate-700 mt-4 block">Número que você quer conectar</label>
        <div className="mt-2 flex flex-col md:flex-row gap-3">
          <input
            value={phone}
            onChange={e => { setPhone(e.target.value); setPhoneValidated(false); }}
            placeholder="Ex.: 94 99999-9999"
            className={`flex-1 border rounded-xl px-4 py-3 outline-none ${phoneValidated ? 'border-emerald-400 bg-emerald-50/30' : 'focus:border-brand-500'}`}
          />
          <button disabled={busy} onClick={validatePhone} className="px-5 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {phoneValidated ? <CheckCircle2 size={18}/> : <Smartphone size={18}/>} {phoneValidated ? 'Número validado' : 'Validar número'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">A validação confere o formato. A conexão real acontece quando você escanear o QR com a conta desejada.</p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button disabled={busy || !providerConfigured || !phoneValidated} onClick={prepareConnection} className="w-full md:w-auto px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <QrCode size={18}/>{busy ? 'Conectando...' : pending ? 'Gerar novo QR' : 'Gerar QR real de conexão'}
          </button>
          <button disabled={busy || !providerConfigured || !phoneValidated} onClick={generatePairingCode} className="w-full md:w-auto px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2">
            <Smartphone size={18}/>Gerar código de pareamento
          </button>
        </div>
      </div>

      {(qrCode || pairingCode || (pending && !connected)) && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          {qrCode ? (
            <img src={qrCode} alt="QR de conexão do WhatsApp" className="w-64 h-64 object-contain mx-auto rounded-xl bg-white border p-2"/>
          ) : (
            <div className="w-64 h-64 mx-auto rounded-xl bg-white border flex flex-col items-center justify-center gap-3">
              <QrCode size={56} className="text-slate-300"/>
              <p className="text-sm text-slate-500 px-5">O provedor está preparando a autorização.</p>
            </div>
          )}
          {pairingCode && <div className="mt-4"><p className="text-sm text-slate-600">Código de pareamento (se preferir esse método):</p><p className="text-2xl font-mono font-bold tracking-[0.2em] mt-1">{pairingCode}</p></div>}
          {qrCode ? (
            <p className="font-semibold text-slate-800 mt-4">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie o QR.</p>
          ) : pairingCode ? (
            <p className="font-semibold text-slate-800 mt-4">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone e digite o código acima.</p>
          ) : (
            <p className="font-semibold text-slate-800 mt-4">Aguardando o provedor gerar a autorização...</p>
          )}
          <p className="text-sm text-slate-500 mt-1">Digite o código apenas no WhatsApp do seu celular; nunca envie códigos de verificação para ninguém.</p>
          <button disabled={busy} onClick={checkStatus} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border font-semibold text-sm disabled:opacity-50"><RefreshCw size={16}/>Verificar conexão</button>
        </div>
      )}

      {connected && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm"><CheckCircle2 className="text-emerald-600" /></div>
              <div>
                <p className="font-bold text-slate-900">{connection?.display_name || 'WhatsApp conectado'}</p>
                <p className="text-sm text-slate-600">{displayPhone(connection?.phone_number || '') || 'Sessão autenticada'}</p>
              </div>
            </div>
            <button disabled={busy} onClick={disconnect} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2 justify-center"><Unplug size={17}/>Desconectar</button>
          </div>
          <div className="border-t border-emerald-200 pt-4 space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-2"><Send size={17}/>Testar envio real</h4>
            <input value={testPhone} onChange={e=>setTestPhone(e.target.value)} placeholder="Número que vai receber o teste" className="w-full border rounded-xl px-4 py-3 bg-white"/>
            <textarea value={testMessage} onChange={e=>setTestMessage(e.target.value)} className="w-full border rounded-xl px-4 py-3 bg-white min-h-20" placeholder="Mensagem de teste"/>
            <button disabled={busy} onClick={sendTest} className="px-5 py-3 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50">{busy ? 'Enviando...' : 'Enviar mensagem de teste'}</button>
          </div>
        </div>
      )}

      {connection?.last_error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{connection.last_error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-4"><LockKeyhole size={18} className="mb-2 text-slate-700"/><p className="font-semibold">Chave protegida</p><p className="text-slate-500 mt-1">A chave do provedor fica no Vault do servidor, não no código público.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><ShieldCheck size={18} className="mb-2 text-slate-700"/><p className="font-semibold">Separado por usuário</p><p className="text-slate-500 mt-1">Cada conta do Horizon mantém sua própria instância e conexão.</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><RefreshCw size={18} className="mb-2 text-slate-700"/><p className="font-semibold">Fila automática</p><p className="text-slate-500 mt-1">A fila é processada pelo servidor a cada minuto, sem depender de deixar a tela aberta.</p></div>
      </div>
    </section>
  );
}
