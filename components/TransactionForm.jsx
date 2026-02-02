import React, { useState, useMemo } from 'react';
import { Origin, TransactionType, TransactionStatus, BUSINESS_TABS, BUSINESS_EXPENSE_CATEGORIES, HOME_CATEGORIES, CONSUMERS, Transaction } from '../types';
import { GLASS_CLASSES, GLASS_INPUT, GLASS_BUTTON_PRIMARY } from '../constants';
import { 
  Save, User, Coffee, ShoppingBag, DollarSign, 
  Briefcase, Home, Zap, Utensils, Car, Tag, Trash2, 
  ChevronLeft, ChevronRight, Activity, Crown, CheckCircle2, HeartHandshake,
  HandCoins, Calendar, CreditCard, Package
} from 'lucide-react';
import { format, isSameMonth, addDays, subDays, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface TransactionFormProps {
  onSave: (data: any) => Promise<void>;
  userId: string;
  recentTransactions: Transaction[];
  onDelete?: (id: string) => void;
  onSettleDebt?: (id: string) => Promise<void>;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onSave, userId, recentTransactions, onDelete, onSettleDebt }) => {
  const [origin, setOrigin] = useState<Origin>(Origin.BUSINESS);
  const [activeTab, setActiveTab] = useState<string>(BUSINESS_TABS.CONSUMO_CLIENTES);
  
  // Date Navigation State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  
  // Specific Fields
  const [client, setClient] = useState<string>('');
  const [consumer, setConsumer] = useState<string>(CONSUMERS[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>(HOME_CATEGORIES[0]);
  const [businessExpenseCat, setBusinessExpenseCat] = useState<string>(BUSINESS_EXPENSE_CATEGORIES[0]);
  
  // Debt / Fiado State
  const [isPending, setIsPending] = useState(false);

  // --- Date Handlers ---
  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleGoToday = () => setSelectedDate(new Date());

  const getCategoryAndType = () => {
    let type = TransactionType.EXPENSE;
    let finalCategory = '';

    if (origin === Origin.BUSINESS) {
      switch (activeTab) {
        case BUSINESS_TABS.CONSUMO_CLIENTES:
          type = TransactionType.INCOME;
          finalCategory = 'Consumo en Club';
          break;
        case BUSINESS_TABS.VENTA_PRODUCTO:
          type = TransactionType.INCOME;
          finalCategory = 'Producto Cerrado';
          break;
        case BUSINESS_TABS.REGALIAS:
          type = TransactionType.INCOME; // Recorded as income, handled differently in reports
          finalCategory = 'Regalías';
          break;
        case BUSINESS_TABS.CONSUMO_PROPIO:
          type = TransactionType.EXPENSE; // Accounting: Expense of Inventory
          finalCategory = 'Consumo Interno';
          break;
        case BUSINESS_TABS.GASTOS:
          type = TransactionType.EXPENSE;
          finalCategory = businessExpenseCat;
          break;
        case BUSINESS_TABS.PAGO_TARJETA:
          type = TransactionType.EXPENSE;
          finalCategory = 'Pago Tarjeta Crédito';
          break;
        case BUSINESS_TABS.INVENTARIO_INICIAL:
          // CHANGE: Inventory is an ASSET (Value), so we treat it as INCOME/POSITIVE for the Business Value
          type = TransactionType.INCOME; 
          finalCategory = 'Inventario Inicial';
          break;
        default:
          finalCategory = 'Otros';
      }
    } else {
      finalCategory = selectedCategory;
      // "Aporte Familiar" logic: It's Income (contribution)
      if (selectedCategory === 'Aporte Familiar') {
          type = TransactionType.INCOME;
      } else {
          type = TransactionType.EXPENSE;
      }
    }
    return { type, finalCategory };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    setLoading(true);
    const { type, finalCategory } = getCategoryAndType();

    // Validation: Client Name for Sales
    if (origin === Origin.BUSINESS && (activeTab === BUSINESS_TABS.CONSUMO_CLIENTES || activeTab === BUSINESS_TABS.VENTA_PRODUCTO)) {
         if (!client.trim()) {
             alert("El nombre del cliente es obligatorio para ventas y consumo.");
             setLoading(false);
             return;
         }
    }

    // Validation: Note for 'Otros' in Home
    if (origin === Origin.HOME && selectedCategory === 'Otros' && !note.trim()) {
        alert("Por favor especifica el detalle del gasto 'Otros'.");
        setLoading(false);
        return;
    }
    
    // NOTE: Using selectedDate.getTime() instead of Date.now() to register for the viewed date
    const payload: any = {
      amount: Number(amount),
      origin,
      type,
      category: finalCategory,
      note,
      date: selectedDate.getTime(), 
      userId,
      status: (type === TransactionType.INCOME && isPending) ? TransactionStatus.PENDING : TransactionStatus.PAID
    };

    if (origin === Origin.BUSINESS) {
        if (activeTab === BUSINESS_TABS.CONSUMO_PROPIO) {
            payload.consumer = consumer;
            payload.note = `${note} [${consumer}]`.trim();
        }
        if (activeTab === BUSINESS_TABS.CONSUMO_CLIENTES || activeTab === BUSINESS_TABS.VENTA_PRODUCTO) {
            payload.client = client;
        }
    }

    await onSave(payload);
    
    // Reset Partial State
    setAmount('');
    setNote('');
    setClient('');
    setIsPending(false); // Reset toggle
    setLoading(false);
  };

  const handleSettle = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!onSettleDebt) return;
      
      setSettlingId(id);
      await onSettleDebt(id);
      setSettlingId(null);
  };

  const getIconForCategory = (cat: string) => {
    const props = { size: 24, strokeWidth: 1.5 };
    if (cat.includes('Arriendo')) return <Home {...props} />;
    if (cat.includes('Servicios')) return <Zap {...props} />;
    if (cat.includes('Comida')) return <Utensils {...props} />;
    if (cat.includes('Transporte')) return <Car {...props} />;
    if (cat.includes('Ocio')) return <Coffee {...props} />;
    if (cat.includes('Aporte')) return <HeartHandshake {...props} />;
    return <Tag {...props} />;
  };

  // Filter History by Selected Date (Show all for that day, not just 10)
  const filteredHistory = useMemo(() => {
    return recentTransactions
        .filter(t => t.origin === origin && isSameDay(t.date, selectedDate))
        .sort((a, b) => b.date - a.date);
  }, [recentTransactions, origin, selectedDate]);

  // Sidebar Metric Logic
  const sidebarMetric = useMemo(() => {
      if (origin === Origin.BUSINESS) {
        // Business Logic: Real Cash Flow FOR SELECTED DAY
        const total = recentTransactions.filter(t => 
            t.origin === Origin.BUSINESS && 
            isSameDay(t.date, selectedDate) // Only calculate for the day viewed
        ).reduce((acc, curr) => {
            // Ignore Pending
            if(curr.status === TransactionStatus.PENDING) return acc;
    
            // Exclude Initial Inventory from CASH flow (it's value, not liquid cash)
            if (curr.category === 'Inventario Inicial') return acc;

            // Add Sales (Clients/Products only)
            if (curr.type === TransactionType.INCOME && curr.category !== 'Regalías') {
                return acc + curr.amount;
            }
            
            // Subtract Operating Expenses + Credit Cards
            // Exclude 'Consumo Interno' as it's not cash out
            if (curr.type === TransactionType.EXPENSE && curr.category !== 'Consumo Interno') {
                return acc - curr.amount;
            }
    
            return acc;
        }, 0);

        return {
            title: isToday(selectedDate) ? "Caja Negocio (Hoy)" : `Caja del ${format(selectedDate, 'd MMM')}`,
            amount: total,
            desc: "Efectivo Real: Ventas - Gastos - Tarjetas (Sin Inventario/Pendientes)."
        };
      } else {
        // Home Logic: Cost of Living (MONTH of Selected Date)
        const monthTransactions = recentTransactions.filter(t => 
            t.origin === Origin.HOME && isSameMonth(t.date, selectedDate)
        );

        let expenses = 0;
        let contributions = 0;

        monthTransactions.forEach(t => {
            if (t.category === 'Aporte Familiar' || t.type === TransactionType.INCOME) {
                contributions += t.amount;
            } else {
                expenses += t.amount;
            }
        });

        const costOfLiving = expenses - contributions;

        return {
            title: `Costo Vida (${format(selectedDate, 'MMM')})`,
            amount: costOfLiving,
            desc: "Gastos - Aportes (Acumulado Mensual)."
        };
      }
  }, [recentTransactions, origin, selectedDate]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
      
      {/* LEFT COLUMN: FORM */}
      <div className={`flex-1 ${GLASS_CLASSES} p-8`}>
        
        {/* Header Switcher */}
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className={`p-2 rounded-xl ${origin === Origin.BUSINESS ? 'bg-slate-100 text-slate-900' : 'bg-rose-50 text-rose-600'}`}>
                    {origin === Origin.BUSINESS ? <Briefcase size={24} strokeWidth={1.5} /> : <Home size={24} strokeWidth={1.5} />}
                </div>
                {origin === Origin.BUSINESS ? "Gestión del Negocio" : "Finanzas del Hogar"}
            </h2>
            <button 
                onClick={() => setOrigin(prev => prev === Origin.BUSINESS ? Origin.HOME : Origin.BUSINESS)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
            >
                Cambiar a {origin === Origin.BUSINESS ? "Hogar" : "Negocio"}
            </button>
        </div>

        {/* DATE SELECTION BANNER (New) */}
        {!isToday(selectedDate) && (
             <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2 text-amber-800 text-sm font-bold">
                    <Calendar size={18} />
                    <span>Registrando para: {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</span>
                </div>
                <button 
                    onClick={handleGoToday}
                    className="text-xs font-bold uppercase bg-white px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                    Volver a Hoy
                </button>
             </div>
        )}

        {/* BUSINESS TABS */}
        {origin === Origin.BUSINESS && (
            <div className="flex overflow-x-auto pb-4 mb-6 gap-2 no-scrollbar border-b border-slate-100">
                {Object.values(BUSINESS_TABS).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                            activeTab === tab 
                            ? 'bg-slate-900 text-white shadow-md' 
                            : 'bg-white text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* 1. Client Input (Now for both Consumption and Sales) */}
            {origin === Origin.BUSINESS && (activeTab === BUSINESS_TABS.CONSUMO_CLIENTES || activeTab === BUSINESS_TABS.VENTA_PRODUCTO) && (
                <div className="animate-fade-in">
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Cliente (Obligatorio)</label>
                     <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            value={client}
                            onChange={(e) => setClient(e.target.value)}
                            placeholder="Nombre del Cliente"
                            className={`${GLASS_INPUT} pl-12 bg-white`}
                        />
                    </div>
                </div>
            )}

            {/* 2. Amount Input & Debt Toggle */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Monto de Transacción</label>
                    
                    {/* FIADO TOGGLE */}
                    {origin === Origin.BUSINESS && ['Consumo Clientes', 'Venta Producto'].includes(activeTab) && (
                        <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold uppercase tracking-wider ${isPending ? 'text-amber-600' : 'text-slate-400'}`}>
                                {isPending ? 'Venta Pendiente (Fiado)' : 'Pago Inmediato'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsPending(!isPending)}
                                className={`w-12 h-7 rounded-full transition-colors relative ${isPending ? 'bg-amber-500' : 'bg-slate-200'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform ${isPending ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-8 h-8" strokeWidth={1.5} />
                    <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className={`${GLASS_INPUT} pl-14 text-5xl font-bold h-24 bg-white border-slate-200 focus:border-slate-400 focus:ring-0 ${isPending ? 'text-amber-600' : 'text-slate-900'}`}
                        required
                    />
                </div>
            </div>

            {/* 3. HOME GRID or BUSINESS SPECIFICS */}
            
            {/* HOME GRID */}
            {origin === Origin.HOME && (
                <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Categoría</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {HOME_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all h-28 ${
                                    selectedCategory === cat 
                                    ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm ring-1 ring-rose-200' 
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                                }`}
                            >
                                <div className="mb-2">{getIconForCategory(cat)}</div>
                                <span className="text-xs font-bold text-center leading-tight">{cat}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* BUSINESS SPECIFICS */}
            {origin === Origin.BUSINESS && (
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    
                    {/* CONSUMO PROPIO AVATARS */}
                    {activeTab === BUSINESS_TABS.CONSUMO_PROPIO && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">¿Quién consume?</label>
                            <div className="flex gap-4 justify-center">
                                {CONSUMERS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setConsumer(c)}
                                        className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-all shadow-sm ${
                                            consumer === c 
                                            ? 'bg-amber-500 text-white scale-110 shadow-amber-500/30' 
                                            : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {c.charAt(0)}
                                    </button>
                                ))}
                            </div>
                            <p className="text-center text-xs text-slate-400 mt-2 font-medium">{consumer}</p>
                        </div>
                    )}

                    {/* EXPENSES */}
                    {activeTab === BUSINESS_TABS.GASTOS && (
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Tipo de Gasto</label>
                            <div className="grid grid-cols-2 gap-3">
                                {BUSINESS_EXPENSE_CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setBusinessExpenseCat(cat)}
                                        className={`px-3 py-3 rounded-xl text-xs font-bold uppercase transition-all ${
                                            businessExpenseCat === cat 
                                            ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* NEW TAB INDICATORS */}
                    {activeTab === BUSINESS_TABS.PAGO_TARJETA && (
                        <div className="text-center text-rose-500 py-4 flex flex-col items-center justify-center gap-2">
                             <CreditCard size={32} strokeWidth={1.5} />
                             <span className="text-sm font-bold">Registrar Pago de Tarjeta</span>
                             <p className="text-xs text-slate-400">Se restará de la ganancia neta.</p>
                        </div>
                    )}

                    {activeTab === BUSINESS_TABS.INVENTARIO_INICIAL && (
                        <div className="text-center text-emerald-600 py-4 flex flex-col items-center justify-center gap-2">
                             <Package size={32} strokeWidth={1.5} />
                             <span className="text-sm font-bold">Registrar Inventario Inicial</span>
                             <p className="text-xs text-slate-400">Suma al valor del negocio (Activo).</p>
                        </div>
                    )}

                    {/* INFO */}
                    {['Venta Producto', 'Regalías', 'Consumo Clientes'].includes(activeTab) && (
                        <div className="text-center text-slate-400 py-2 flex items-center justify-center gap-2">
                             <CheckCircle2 size={16}/>
                             <span className="text-xs font-medium">Listo para registrar</span>
                        </div>
                    )}
                </div>
            )}

            {/* Note Input */}
            <div>
                 <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={origin === Origin.HOME && selectedCategory === 'Otros' ? "Detalle obligatorio..." : "Añadir nota opcional..."}
                    className={`${GLASS_INPUT} text-sm bg-white ${origin === Origin.HOME && selectedCategory === 'Otros' && !note ? 'ring-1 ring-rose-200' : ''}`}
                />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                    <p className={`text-3xl font-bold ${isPending ? 'text-amber-500' : 'text-slate-900'}`}>${amount || '0.00'}</p>
                </div>
                <button 
                    type="submit" 
                    disabled={loading}
                    className={`${GLASS_BUTTON_PRIMARY} w-auto px-10 !rounded-full ${isPending ? '!bg-amber-600 hover:!bg-amber-700 shadow-amber-900/10' : ''}`}
                >
                    {loading ? '...' : (
                        <span className="flex items-center gap-2 uppercase tracking-wide text-sm">
                            {isPending ? 'Fiado' : 'Registrar'} <Save size={18} />
                        </span>
                    )}
                </button>
            </div>
        </form>
      </div>

      {/* RIGHT COLUMN: HISTORY */}
      <div className={`w-full lg:w-96 ${GLASS_CLASSES} p-0 overflow-hidden flex flex-col h-[600px] lg:h-auto`}>
         {/* Header with Navigation */}
         <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
            <button 
                onClick={handlePrevDay}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
                title="Día anterior"
            >
                <ChevronLeft size={20} />
            </button>
            <div className="text-center">
                <h3 className="text-slate-900 font-bold text-sm capitalize">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                    {filteredHistory.length} Registros
                </span>
            </div>
            <button 
                onClick={handleNextDay}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
                title="Día siguiente"
            >
                <ChevronRight size={20} />
            </button>
         </div>

         {/* Total Box - Dynamic based on Origin */}
         <div className="p-8 bg-slate-50 border-b border-slate-100 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{sidebarMetric.title}</p>
            <h2 className={`text-5xl font-bold ${sidebarMetric.amount >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                ${sidebarMetric.amount.toFixed(2)}
            </h2>
            <p className="text-[10px] text-slate-400 mt-2 font-medium mx-auto max-w-[200px] leading-relaxed">
                {sidebarMetric.desc}
            </p>
         </div>

         {/* List */}
         <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-slate-50/50">
            {filteredHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-70">
                    <Activity size={48} className="mb-4 text-slate-300" strokeWidth={1} />
                    <p className="font-medium">Sin movimientos</p>
                </div>
            ) : (
                filteredHistory.map(t => (
                    <div key={t.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all relative overflow-hidden">
                        
                        {/* Pending Indicator Strip */}
                        {t.status === TransactionStatus.PENDING && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-400"></div>
                        )}

                        <div className="flex items-center gap-4 pl-2">
                            <div className={`w-2 h-2 rounded-full ${t.type === TransactionType.INCOME ? (t.status === TransactionStatus.PENDING ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-rose-500'}`}></div>
                            <div>
                                <p className="text-slate-900 font-bold text-sm">{t.category}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[120px] font-medium">
                                    {t.client || t.consumer || t.note || t.origin}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`font-bold text-sm ${t.status === TransactionStatus.PENDING ? 'text-amber-600' : (t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600')}`}>
                                {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toFixed(2)}
                            </p>
                            {t.status === TransactionStatus.PENDING && (
                                <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-[9px] font-bold uppercase text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded">Pendiente</span>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bottom-2 bg-white pl-2 items-center">
                                {/* Settle Debt Button */}
                                {t.status === TransactionStatus.PENDING && onSettleDebt && t.id && (
                                    <button 
                                        className="text-slate-400 hover:text-emerald-500 transition-colors"
                                        title="Cobrar (Marcar como Pagado)"
                                        onClick={(e) => handleSettle(e, t.id!)}
                                        disabled={settlingId === t.id}
                                    >
                                        <HandCoins size={18} className={settlingId === t.id ? 'animate-pulse' : ''} />
                                    </button>
                                )}
                                <button className="text-slate-400 hover:text-rose-500 transition-colors" onClick={() => onDelete && t.id && onDelete(t.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
         </div>
      </div>

    </div>
  );
};

export default TransactionForm;