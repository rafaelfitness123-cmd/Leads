import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  MessageSquare, 
  CheckCircle2, 
  TrendingUp, 
  Clock,
  ChevronRight,
  Plus,
  Instagram
} from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion } from 'framer-motion';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    contacted: 0,
    responded: 0,
    interested: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!auth.currentUser) return;
      const leadsRef = collection(db, 'leads');
      const q = query(leadsRef, where('ownerId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      
      const counts = {
        totalLeads: snap.size,
        newLeads: snap.docs.filter(d => d.data().status === 'new').length,
        contacted: snap.docs.filter(d => d.data().status === 'contacted').length,
        responded: snap.docs.filter(d => d.data().status === 'responded').length,
        interested: snap.docs.filter(d => d.data().status === 'interested').length,
      };
      setStats(counts);
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total de Leads', value: stats.totalLeads, icon: Users, color: 'bg-blue-500' },
    { label: 'Leads Novos', value: stats.newLeads, icon: UserPlus, color: 'bg-indigo-500' },
    { label: 'Contatados', value: stats.contacted, icon: MessageSquare, color: 'bg-amber-500' },
    { label: 'Respondidos', value: stats.responded, icon: CheckCircle2, color: 'bg-emerald-500' },
    { label: 'Interessados', value: stats.interested, icon: TrendingUp, color: 'bg-rose-500' },
  ];

  const chartData = [
    { name: 'Seg', leads: 4 },
    { name: 'Ter', leads: 7 },
    { name: 'Qua', leads: 5 },
    { name: 'Qui', leads: 12 },
    { name: 'Sex', leads: 8 },
    { name: 'Sáb', leads: 3 },
    { name: 'Dom', leads: 2 },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500">Bem-vindo de volta! Aqui está o resumo da sua prospecção.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="premium-card p-5 flex flex-col gap-3"
          >
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white shadow-lg shadow-slate-200`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 premium-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Atividade de Prospecção</h3>
            <select className="text-sm bg-slate-50 border-none rounded-lg px-3 py-1 outline-none">
              <option>Últimos 7 dias</option>
              <option>Último mês</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="leads" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Boards */}
        <div className="premium-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Quadros Recentes</h3>
            <button 
              onClick={() => setActiveTab('boards')}
              className="text-sm text-brand-600 font-semibold hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="space-y-4 flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500 transition-colors">
                  <Instagram size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">Estética Avançada | Belém</p>
                  <p className="text-xs text-slate-500">12 leads • 45% resposta</p>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-600" />
              </div>
            ))}
          </div>
          <button 
            onClick={() => setActiveTab('boards')}
            className="mt-6 w-full py-2.5 bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Novo Quadro
          </button>
        </div>
      </div>
    </div>
  );
}
