import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Palette, 
  Bell, 
  Globe, 
  Lock,
  Save,
  CheckCircle2,
  Instagram,
  Tag,
  Zap
} from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Config() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('perfil');
  const [settings, setSettings] = useState({
    displayName: '',
    email: '',
    theme: 'light',
    notifications: true,
    autoParse: true,
    defaultNiche: 'Estética',
    instagramLink: '',
    twoFactor: false,
    language: 'pt-BR',
    privacyMode: false
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snap.exists()) {
        setSettings(prev => ({ ...prev, ...snap.data() }));
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), settings);
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    { id: 'seguranca', label: 'Segurança', icon: Lock },
    { id: 'integracoes', label: 'Integrações', icon: Globe },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Configurações</h2>
          <p className="text-slate-500">Personalize sua conta e preferências do sistema.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
        >
          {saving ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Nav */}
        <div className="space-y-2">
          {tabs.map((item) => (
            <div 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                activeTab === item.id ? 'bg-white border border-slate-200 shadow-sm text-brand-600' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <item.icon size={18} />
              <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card p-8 space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'perfil' && (
                <motion.section 
                  key="perfil"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <User size={20} className="text-brand-500" />
                    Informações do Perfil
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Nome de Exibição</label>
                      <input 
                        type="text" 
                        value={settings.displayName}
                        onChange={e => setSettings({...settings, displayName: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">E-mail</label>
                      <input 
                        disabled
                        type="email" 
                        value={settings.email}
                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm text-slate-400 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </motion.section>
              )}

              {activeTab === 'aparencia' && (
                <motion.section 
                  key="aparencia"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Palette size={20} className="text-brand-500" />
                    Aparência do Sistema
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setSettings({...settings, theme: 'light'})}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${settings.theme === 'light' ? 'border-brand-500 bg-brand-50' : 'border-slate-100'}`}
                    >
                      <div className="w-full h-20 bg-white rounded-lg mb-3 border border-slate-200" />
                      <p className="font-bold text-sm text-slate-900">Modo Claro</p>
                    </button>
                    <button 
                      onClick={() => setSettings({...settings, theme: 'dark'})}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${settings.theme === 'dark' ? 'border-brand-500 bg-brand-50' : 'border-slate-100'}`}
                    >
                      <div className="w-full h-20 bg-slate-900 rounded-lg mb-3" />
                      <p className="font-bold text-sm text-slate-900">Modo Escuro (Beta)</p>
                    </button>
                  </div>
                </motion.section>
              )}

              {activeTab === 'notificacoes' && (
                <motion.section 
                  key="notificacoes"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Bell size={20} className="text-brand-500" />
                    Notificações
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Alertas de Navegador</p>
                        <p className="text-xs text-slate-500">Receber avisos sobre novos leads qualificados.</p>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.notifications ? 'bg-brand-500' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notifications ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </motion.section>
              )}

              {activeTab === 'seguranca' && (
                <motion.section 
                  key="seguranca"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Shield size={20} className="text-brand-500" />
                    Segurança e Privacidade
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Autenticação em Duas Etapas</p>
                        <p className="text-xs text-slate-500">Adicionar uma camada extra de proteção.</p>
                      </div>
                      <button 
                        onClick={() => setSettings({...settings, twoFactor: !settings.twoFactor})}
                        className={`w-12 h-6 rounded-full transition-all relative ${settings.twoFactor ? 'bg-brand-500' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.twoFactor ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </motion.section>
              )}

              {activeTab === 'integracoes' && (
                <motion.section 
                  key="integracoes"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Globe size={20} className="text-brand-500" />
                    Integrações Externas
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200">
                          <Instagram size={20} className="text-pink-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">Instagram API</p>
                          <p className="text-xs text-slate-500">Conectado como @seu_perfil</p>
                        </div>
                      </div>
                      <button className="text-xs font-bold text-brand-600 hover:underline">Configurar</button>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            <hr className="border-slate-100" />

            {/* System Section */}
            <section className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Zap size={20} className="text-brand-500" />
                Preferências do Sistema
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Parsing Automático</p>
                    <p className="text-xs text-slate-500">Processar textos brutos assim que forem colados.</p>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, autoParse: !settings.autoParse})}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.autoParse ? 'bg-brand-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoParse ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nicho Padrão</label>
                    <input 
                      type="text" 
                      value={settings.defaultNiche}
                      onChange={e => setSettings({...settings, defaultNiche: e.target.value})}
                      placeholder="Ex: Estética"
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Seu Instagram (Link)</label>
                    <input 
                      type="text" 
                      value={settings.instagramLink}
                      onChange={e => setSettings({...settings, instagramLink: e.target.value})}
                      placeholder="https://instagram.com/seu_perfil"
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
