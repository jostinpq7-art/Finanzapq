import React, { useState, useEffect } from 'react';
import { auth, googleProvider, isMock } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { addTransaction, getUserTransactions, updateTransactionStatus } from './services/transactionService';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import { GLASS_BUTTON_PRIMARY, GLASS_CLASSES } from './constants';
import { LayoutDashboard, Plus, LogOut, Hexagon, AlertTriangle } from 'lucide-react';

const Alert = ({ message, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
    <div className={`${GLASS_CLASSES} p-8 max-w-sm w-full text-center bg-white shadow-2xl`}>
      <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
        <Plus className="w-6 h-6 text-emerald-600" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">¡Guardado!</h3>
      <p className="text-slate-500 mb-6">{message}</p>
      <button onClick={onClose} className={GLASS_BUTTON_PRIMARY}>Aceptar</button>
    </div>
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [alertMessage, setAlertMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMock) {
      const storedUser = localStorage.getItem('demo_glass_user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        loadData(parsedUser.uid);
      }
      setLoading(false);
    } else if (auth) {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          await loadData(currentUser.uid);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const loadData = async (uid) => {
    const data = await getUserTransactions(uid);
    setTransactions(data);
  };

  const handleLogin = async () => {
    if (isMock) {
      const mockUser = {
        uid: "demo_user_123",
        displayName: "Usuario Demo",
        email: "demo@glass.app",
        photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
      };
      localStorage.setItem('demo_glass_user', JSON.stringify(mockUser));
      setUser(mockUser);
      await loadData(mockUser.uid);
      return;
    }

    try {
      if (auth && googleProvider) {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error("Login failed", error);
      alert("Error de configuración de Firebase. Revise la consola.");
    }
  };

  const handleLogout = () => {
    if (isMock) {
      localStorage.removeItem('demo_glass_user');
      setUser(null);
      setTransactions([]);
      return;
    }

    if (auth) {
      signOut(auth);
      setTransactions([]);
    }
  };

  const handleSaveTransaction = async (data) => {
    if (!user) return;
    try {
      await addTransaction(data);
      setAlertMessage("La transacción ha sido registrada exitosamente.");
      await loadData(user.uid);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSettleDebt = async (id) => {
      if(!user) return;
      try {
          // Asumiendo que TransactionStatus.PAID es 'paid'
          await updateTransactionStatus(id, 'paid');
          await loadData(user.uid);
      } catch (e) {
          console.error(e);
      }
  };

  const handleDeleteTransaction = (id) => {
      const newTransactions = transactions.filter(t => t.id !== id);
      setTransactions(newTransactions);
      if(isMock) {
        localStorage.setItem('demo_glass_transactions', JSON.stringify(newTransactions));
      }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-900 bg-[#F8F9FA]">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8F9FA]">
        <div className={`max-w-md w-full p-10 ${GLASS_CLASSES} text-center shadow-xl`}>
          <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-slate-900/20">
            <Hexagon className="w-8 h-8 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Finanzas Glass</h1>
          <p className="text-slate-500 mb-8 font-medium">Gestión inteligente para tu Club y Hogar.</p>
          
          {isMock && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center justify-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4" />
              <span>Modo Demo (Sin Backend)</span>
            </div>
          )}

          <button onClick={handleLogin} className={GLASS_BUTTON_PRIMARY}>
            {isMock ? 'Ingresar (Modo Prueba)' : 'Iniciar Sesión con Google'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-6 relative bg-[#F8F9FA]">
      {alertMessage && <Alert message={alertMessage} onClose={() => setAlertMessage(null)} />}

      <header className="px-6 py-4 flex justify-between items-center sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-100 shadow-sm">
             {user.photoURL && <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-slate-900 font-bold text-sm leading-tight">Hola, {user.displayName?.split(' ')[0]}</h1>
              {isMock && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 font-bold tracking-wide">DEMO</span>}
            </div>
            <p className="text-slate-500 text-xs font-medium">Bienvenido de nuevo</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 rounded-xl">
          <LogOut className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {view === 'dashboard' ? (
          <div className="animate-fade-in">
            <Dashboard transactions={transactions} onSettleDebt={handleSettleDebt} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <TransactionForm 
                onSave={handleSaveTransaction} 
                userId={user.uid} 
                recentTransactions={transactions}
                onDelete={handleDeleteTransaction}
                onSettleDebt={handleSettleDebt}
            />
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
        <div className={`flex items-center gap-3 p-2 bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl`}>
          <button 
            onClick={() => setView('dashboard')}
            className={`p-4 rounded-xl transition-all ${view === 'dashboard' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
          >
            <LayoutDashboard className="w-6 h-6" strokeWidth={2} />
          </button>
          <button 
            onClick={() => setView('form')}
            className={`p-4 rounded-xl transition-all ${view === 'form' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
          >
            <Plus className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;