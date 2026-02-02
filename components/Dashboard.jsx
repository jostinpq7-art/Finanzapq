import React, { useState, useMemo } from 'react';
import { Transaction, Origin, TransactionType, TransactionStatus, CONSUMERS } from '../types';
import { GLASS_CLASSES } from '../constants';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet, Users, 
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Calendar,
  PieChart as PieIcon, Activity, Crown, AlertCircle, HeartHandshake, Home,
  CreditCard, Package
} from 'lucide-react';
import { 
  startOfMonth, endOfMonth, startOfYear, endOfYear, 
  addMonths, subMonths, format, isWithinInterval 
} from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardProps {
  transactions: Transaction[];
  onSettleDebt?: (transactionId: string) => Promise<void>;
}

// Fintech Color Palette for Charts
const COLORS = {
  sales: '#059669', // Emerald
  businessExpense: '#E11D48', // Carmine
  profit: '#0F172A' // Slate
};

// Family Member Specific Colors
const FAMILY_COLORS: Record<string, string> = {
  "Amarilis": "#8B5CF6", // Violet
  "Luis": "#3B82F6",     // Blue
  "Hijos": "#F59E0B",    // Amber
  "Invitados": "#10B981" // Emerald
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, onSettleDebt }) => {
  // Navigation State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  // --- Navigation Handlers ---
  const handlePrev = () => {
    setCurrentDate(prev => viewMode === 'month' ? subMonths(prev, 1) : subMonths(prev, 12));
  };

  const handleNext = () => {
    setCurrentDate(prev => viewMode === 'month' ? addMonths(prev, 1) : addMonths(prev, 12));
  };

  const handleSetCurrent = () => setCurrentDate(new Date());

  // --- Filtering Logic (The "Time Travel") ---
  const { filteredTransactions, dateLabel } = useMemo(() => {
    let start, end, label;

    if (viewMode === 'month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
      label = format(currentDate, 'MMMM yyyy', { locale: es });
    } else {
      start = startOfYear(currentDate);
      end = endOfYear(currentDate);
      label = format(currentDate, 'yyyy', { locale: es });
    }

    const filtered = transactions.filter(t => 
      isWithinInterval(t.date, { start, end })
    );

    return { filteredTransactions: filtered, dateLabel: label };
  }, [transactions, currentDate, viewMode]);

  // --- Metrics Calculation ---
  const metrics = useMemo<{
      businessSalesPaid: number; // Consumo + Venta Producto (PAID only)
      businessPending: number; // Consumo + Venta Producto (PENDING only)
      royalties: number; // Regalías only
      businessOpExpenses: number; // Gastos only (Exclude Internal Consumption, CC, Inventory)
      creditCardPayments: number; // New: Credit Card Payments
      initialInventory: number; // New: Initial Inventory Value
      familyRetailTotal: number;
      familyCostTotal: number; // 50%
      netProfit: number; // Formula provided by user
      familyBreakdown: Record<string, number>;
      homeExpenses: number;
      homeContributions: number; // Aporte Familiar
  }>(() => {
    let businessSalesPaid = 0;
    let businessPending = 0;
    let royalties = 0;
    let businessOpExpenses = 0;
    let creditCardPayments = 0;
    let initialInventory = 0;
    
    // Family Consumption Logic
    let familyRetailTotal = 0;
    const familyBreakdown: Record<string, number> = {};
    
    // Home Logic
    let homeExpenses = 0;
    let homeContributions = 0;

    // Initialize consumers
    CONSUMERS.forEach(c => familyBreakdown[c] = 0);

    filteredTransactions.forEach(t => {
      
      // --- BUSINESS LOGIC ---
      if (t.origin === Origin.BUSINESS) {
        
        // 1. Internal Consumption (Always tracked, not in Op Expenses)
        if (t.category === 'Consumo Interno') {
          familyRetailTotal += t.amount;
          if (t.consumer) {
            familyBreakdown[t.consumer] = (familyBreakdown[t.consumer] || 0) + t.amount;
          }
        } 
        
        // 2. Royalties (Tracked separately)
        else if (t.category === 'Regalías') {
             royalties += t.amount;
        }

        // 3. Special Expenses/Assets
        else if (t.category === 'Pago Tarjeta Crédito') {
            creditCardPayments += t.amount;
        }
        else if (t.category === 'Inventario Inicial') {
            initialInventory += t.amount; // Accumulate absolute value
        }

        // 4. Sales (Clients + Product)
        else if (t.type === TransactionType.INCOME) {
            // Note: We check if category is NOT 'Inventario Inicial' to avoid double counting 
            // if we now save inventory as INCOME type.
            if (t.category !== 'Inventario Inicial') {
                if (t.status === TransactionStatus.PAID) {
                    businessSalesPaid += t.amount;
                } else {
                    businessPending += t.amount;
                }
            }
        }

        // 5. Operating Expenses (Regular Expenses, excluding special types)
        else if (t.type === TransactionType.EXPENSE) {
             businessOpExpenses += t.amount;
        }
      }

      // --- HOME LOGIC ---
      if (t.origin === Origin.HOME) {
          if (t.category === 'Aporte Familiar' || t.type === TransactionType.INCOME) {
              homeContributions += t.amount;
          } else {
              homeExpenses += t.amount;
          }
      }
    });

    // The "50% Cost" Rule
    const familyCostTotal = familyRetailTotal * 0.5;

    // FORMULA UPDATED: 
    // Ganancia Neta = Ventas (Pagadas) + Regalías + Inventario Inicial (Activo) - Gastos Op - Costo Consumo Fam - Pago Tarjetas
    const netProfit = (businessSalesPaid + royalties + initialInventory) - businessOpExpenses - familyCostTotal - creditCardPayments;

    return { 
      businessSalesPaid,
      businessPending,
      royalties,
      businessOpExpenses,
      creditCardPayments,
      initialInventory,
      familyRetailTotal, 
      familyCostTotal,
      familyBreakdown,
      netProfit,
      homeExpenses,
      homeContributions
    };
  }, [filteredTransactions]);

  // --- Chart Data Preparation ---
  const areaChartData = useMemo(() => {
    const groups: {[key: string]: any} = {};
    filteredTransactions.forEach(t => {
        const dateKey = format(t.date, viewMode === 'month' ? 'd MMM' : 'MMM', { locale: es });
        if (!groups[dateKey]) {
            groups[dateKey] = { name: dateKey, sales: 0, expenses: 0 };
        }
        if (t.origin === Origin.BUSINESS) {
            // Plot Sales (Paid) vs All Expenses (Op + CC + Inventory)
            if (t.type === TransactionType.INCOME && t.category !== 'Regalías' && t.category !== 'Inventario Inicial' && t.status === TransactionStatus.PAID) {
                groups[dateKey].sales += t.amount;
            } else if (t.type === TransactionType.EXPENSE && t.category !== 'Consumo Interno') {
                groups[dateKey].expenses += t.amount;
            }
        }
    });
    return Object.values(groups).sort((a:any, b:any) => 0); 
  }, [filteredTransactions, viewMode]);

  const pieChartData = useMemo(() => {
    return (Object.entries(metrics.familyBreakdown) as [string, number][])
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [metrics.familyBreakdown]);

  return (
    <div className="space-y-8">
      
      {/* --- HEADER: Date Navigation --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm sticky top-20 z-30">
        <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
                Mensual
            </button>
            <button 
                onClick={() => setViewMode('year')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'year' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
                Anual
            </button>
        </div>
        <div className="flex items-center gap-6">
            <button onClick={handlePrev} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                <ChevronLeft size={24} />
            </button>
            <div className="text-center min-w-[180px]">
                <h2 className="text-xl font-bold text-slate-900 capitalize flex items-center justify-center gap-2">
                    <Calendar size={18} className="text-slate-400"/> {dateLabel}
                </h2>
            </div>
            <button onClick={handleNext} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                <ChevronRight size={24} />
            </button>
        </div>
        <button onClick={handleSetCurrent} className="text-xs font-bold text-slate-400 hover:text-emerald-600 underline">
            Ir a Hoy
        </button>
      </div>

      {/* ================= BUSINESS SECTION ================= */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-slate-500"/> Análisis de Negocio
        </h2>

        {/* 1. BUSINESS KPI GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Sales */}
            <KPICard 
            title="Ventas Totales (Pagadas)" 
            amount={metrics.businessSalesPaid} 
            icon={<TrendingUp className="text-emerald-600" strokeWidth={1.5} />} 
            bg="bg-emerald-50"
            trend="positive"
            />
            
             {/* Op Expenses */}
             <KPICard 
            title="Gastos Operativos" 
            amount={metrics.businessOpExpenses} 
            icon={<TrendingDown className="text-rose-600" strokeWidth={1.5} />} 
            bg="bg-rose-50"
            trend="negative"
            />
            
            {/* Credit Card Payments (New) */}
            <KPICard 
            title="Pago Tarjetas" 
            amount={metrics.creditCardPayments} 
            icon={<CreditCard className="text-indigo-600" strokeWidth={1.5} />} 
            bg="bg-indigo-50"
            trend="negative"
            />

            {/* Initial Inventory (New) */}
            <KPICard 
            title="Valor Inventario" 
            amount={metrics.initialInventory} 
            icon={<Package className="text-blue-600" strokeWidth={1.5} />} 
            bg="bg-blue-50"
            trend="positive"
            />

            {/* Net Profit - The Big Formula */}
            <KPICard 
            title="Ganancia Neta" 
            amount={metrics.netProfit} 
            icon={<Wallet className="text-slate-700" strokeWidth={1.5} />} 
            bg="bg-slate-100"
            trend={metrics.netProfit >= 0 ? "positive" : "negative"}
            />
            
            {/* Royalties - Extra */}
            <KPICard 
            title="Regalías (Extra)" 
            amount={metrics.royalties} 
            icon={<Crown className="text-purple-600" strokeWidth={1.5} />} 
            bg="bg-purple-50"
            trend="positive"
            />

            {/* Pending - Informative only */}
            <div className={`p-5 ${GLASS_CLASSES} flex flex-col justify-between border-amber-200 bg-amber-50/50 lg:col-span-2`}>
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
                        <AlertCircle size={24} strokeWidth={1.5}/>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-100 px-2 py-1 rounded">Por Cobrar</span>
                </div>
                <div>
                    <p className="text-amber-700/60 text-xs font-bold uppercase tracking-wider mb-1">Pendiente</p>
                    <p className="text-amber-900 text-2xl font-bold tracking-tight">${metrics.businessPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
        </div>

        {/* 2. BUSINESS CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Area Chart */}
            <div className={`lg:col-span-2 p-8 ${GLASS_CLASSES} h-[450px] flex flex-col`}>
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-slate-900 text-lg font-bold">Flujo de Ventas vs Gastos</h3>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Ventas
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <span className="w-3 h-3 rounded-full bg-rose-500"></span> Gastos
                            </div>
                        </div>
                    </div>
                    {/* Added min-w-0 to prevent flex collapse causing recharts width(-1) error */}
                    <div className="flex-1 w-full -ml-4 min-w-0" style={{ minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={areaChartData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.sales} stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor={COLORS.sales} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.businessExpense} stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor={COLORS.businessExpense} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" stroke="#94A3B8" tick={{fill: '#64748B', fontSize: 10}} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#94A3B8" tick={{fill: '#64748B', fontSize: 10}} tickLine={false} axisLine={false} dx={-10} tickFormatter={(value) => `$${value}`} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', color: '#0F172A' }} itemStyle={{ fontSize: '14px', fontWeight: 600 }} />
                                <Area type="monotone" dataKey="sales" stroke={COLORS.sales} strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                <Area type="monotone" dataKey="expenses" stroke={COLORS.businessExpense} strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
            </div>

            {/* Family Breakdown & Cost */}
            <div className={`${GLASS_CLASSES} p-6 flex flex-col`}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <PieIcon className="text-slate-400 w-5 h-5"/>
                        <h3 className="text-slate-900 font-bold">Consumo Familiar</h3>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-bold">COSTO 50%</span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 mb-4 text-center">
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Deducible de Ganancia</p>
                    <p className="text-2xl font-bold text-slate-900">${metrics.familyCostTotal.toFixed(2)}</p>
                </div>

                {/* Pie Chart */}
                <div className="h-40 w-full relative mb-4">
                    {metrics.familyRetailTotal === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-medium">
                            Sin consumo
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={30}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={FAMILY_COLORS[entry.name] || '#CBD5E1'} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} contentStyle={{ borderRadius: '8px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Detailed Table */}
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-48">
                    {(Object.entries(metrics.familyBreakdown) as [string, number][])
                        .sort(([,a], [,b]) => b - a)
                        .map(([name, amount]) => (
                        <div key={name} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FAMILY_COLORS[name] || '#CBD5E1' }}></div>
                                <span className="text-xs font-bold text-slate-700">{name}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-900">${amount.toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* ================= HOME SECTION ================= */}
      <div className="pt-8 border-t border-slate-200">
         <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Home size={20} className="text-slate-500"/> Análisis Finanzas del Hogar
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-6 ${GLASS_CLASSES} bg-white flex items-center justify-between`}>
                 <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Gasto Total Hogar</p>
                    <p className="text-slate-900 text-2xl font-bold tracking-tight">${metrics.homeExpenses.toLocaleString()}</p>
                 </div>
                 <div className="p-3 rounded-xl bg-slate-100 text-slate-600">
                    <TrendingDown size={24}/>
                 </div>
            </div>

            <div className={`p-6 ${GLASS_CLASSES} bg-white flex items-center justify-between border-emerald-100 bg-emerald-50/30`}>
                 <div>
                    <p className="text-emerald-700/70 text-xs font-bold uppercase tracking-wider mb-1">Aportes Familiares</p>
                    <p className="text-emerald-900 text-2xl font-bold tracking-tight">${metrics.homeContributions.toLocaleString()}</p>
                 </div>
                 <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600">
                    <HeartHandshake size={24}/>
                 </div>
            </div>

            <div className={`p-6 ${GLASS_CLASSES} bg-white flex items-center justify-between border-slate-200`}>
                 <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Costo Real de Vida</p>
                    <p className="text-slate-900 text-2xl font-bold tracking-tight">
                        ${(metrics.homeExpenses - metrics.homeContributions).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Gastos - Aportes</p>
                 </div>
                 <div className="p-3 rounded-xl bg-slate-900 text-white">
                    <Wallet size={24}/>
                 </div>
            </div>
        </div>
      </div>

    </div>
  );
};

// Helper Component for KPI Cards
const KPICard = ({ title, amount, icon, bg, trend }: { title: string, amount: number, icon: React.ReactNode, bg: string, trend: 'positive' | 'negative' | 'neutral' }) => (
  <div className={`p-5 ${GLASS_CLASSES} flex flex-col justify-between hover:shadow-md transition-shadow`}>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${bg}`}>
        {icon}
      </div>
      {trend === 'positive' && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">+<ArrowUpRight className="w-3 h-3"/></span>}
      {trend === 'negative' && <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">-<ArrowDownRight className="w-3 h-3"/></span>}
    </div>
    <div>
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
      <p className="text-slate-900 text-2xl font-bold tracking-tight">${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    </div>
  </div>
);

export default Dashboard;