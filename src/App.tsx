import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Columns, 
  Users, 
  MessageSquare, 
  FileUp, 
  BarChart3, 
  Settings, 
  LogOut,
  Instagram,
  Search,
  Plus,
  Bell,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
  CalendarClock
} from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from './supabase-auth';
import { doc, getDoc, setDoc, Timestamp } from './supabase-firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';

// Components
import Dashboard from './components/Dashboard';
import Boards from './components/Boards';
import Leads from './components/Leads';
import Messages from './components/Messages';
import Automations from './components/Automations';
import Import from './components/Import';
import Reports from './components/Reports';
import Config from './components/Config';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              role: 'user',
              createdAt: Timestamp.now()
            });
          }
          setUser(user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Erro ao inicializar usuário:', error);
        setUser(user || null);
      } finally {
        setLoading(false);
      }
    });

    const timeout = window.setTimeout(() => setLoading(false), 8000);
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Login realizado!');
    } catch (error) {
      console.error(error);
      toast.error('Falha no login. Tente novamente.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Sessão encerrada');
    } catch (error) {
      console.error(error);
    }
  };

  const navigateTo = (tab: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center"
        >
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-200">
            <Instagram className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Horizon</h1>
          <p className="text-slate-500 mb-8">Premium Instagram Prospecting CRM. Organize your leads and scale your outreach.</p>
          
          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'boards', label: 'Quadros', icon: Columns },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'messages', label: 'Mensagens', icon: MessageSquare },
    { id: 'automations', label: 'Automações', icon: CalendarClock },
    { id: 'import', label: 'Importação', icon: FileUp },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'config', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="app-shell flex bg-slate-50 overflow-hidden">
      <Toaster position="top-right" richColors />

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="app-sidebar-backdrop fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 md:static md:z-20 md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Menu principal">
        <div className="p-5 sm:p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 shrink-0 bg-brand-600 rounded-lg flex items-center justify-center">
              <Instagram className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Horizon</span>
          </div>
          <button type="button" aria-label="Fechar menu" onClick={() => setMobileNavOpen(false)} className="md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => navigateTo(item.id)}
              aria-current={activeTab === item.id ? "page" : undefined}
              className={`sidebar-item w-full border-0 bg-transparent text-left ${activeTab === item.id ? "active" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group">
            <img 
              src={user.photoURL || ''} 
              alt={user.displayName || ''} 
              className="w-10 h-10 rounded-full border border-slate-200"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-main min-w-0 flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="app-header h-16 shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-3 sm:px-5 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button type="button" aria-label="Abrir menu" onClick={() => setMobileNavOpen(true)} className="app-menu-trigger md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Menu size={21} />
            </button>
            <div className="relative flex-1 min-w-0 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                aria-label="Busca global de leads"
                placeholder="Buscar leads..."
                className="w-full min-w-0 pl-9 pr-3 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-brand-500 rounded-xl text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button aria-label="Notificações" className="hidden sm:inline-flex p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-500 rounded-full border-2 border-white"></span>
            </button>
            <button
              onClick={() => navigateTo("import")}
              className="bg-brand-600 text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-md shadow-brand-100"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Novo Lead</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="app-content flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (selectedBoardId || '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full min-w-0 max-w-7xl mx-auto"
            >
              {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
              {activeTab === 'boards' && (
                <Boards 
                  onSelectBoard={(id) => {
                    setSelectedBoardId(id);
                    setActiveTab('leads');
                  }} 
                />
              )}
              {activeTab === 'leads' && (
                <Leads 
                  boardId={selectedBoardId} 
                  onClearBoard={() => setSelectedBoardId(null)} 
                />
              )}
              {activeTab === 'messages' && <Messages />}
              {activeTab === 'automations' && <Automations />}
              {activeTab === 'import' && <Import initialBoardId={selectedBoardId} />}
              {activeTab === 'reports' && <Reports />}
              {activeTab === 'config' && <Config />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
