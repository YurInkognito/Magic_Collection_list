import React, { useState, useEffect } from 'react';
import { Search, Save, List, Trash2, Filter, ChevronDown, ChevronUp, ExternalLink, Image as ImageIcon, Check, ArrowLeft, User, LogOut, Mail, AlertTriangle } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- CONFIGURAÇÃO DO FIREBASE (LOCAL) ---
// 1. Crie um projeto em console.firebase.google.com
// 2. Adicione um Web App
// 3. Copie as chaves e cole abaixo:
const localFirebaseConfig = {
  apiKey: "AIzaSyCD734ugUX1mDON_0vtXx3a7OU7iUUdbZ0",
  authDomain: "magic-card-list.firebaseapp.com",
  projectId: "magic-card-list",
  storageBucket: "magic-card-list.firebasestorage.app",
  messagingSenderId: "297752798140",
  appId: "1:297752798140:web:aeab914df03c8639a7c1b9",
  measurementId: "G-KT023KDPN3"
};

// --- INICIALIZAÇÃO SEGURA DO FIREBASE ---
let app, auth, db;
let firebaseInitialized = false;

try {
  // Tenta usar a config do ambiente (aqui do chat) ou a local (seu PC)
  const config = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : localFirebaseConfig;

  // Só inicializa se tiver alguma chave configurada
  if (config.apiKey && config.apiKey !== "") {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
  }
} catch (e) {
  console.error("Erro ao inicializar Firebase:", e);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'scryfall-tracker';

export default function App() {
  // --- ESTADOS GLOBAIS ---
  const [activeTab, setActiveTab] = useState('search'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // --- ESTADOS DE USUÁRIO ---
  const [user, setUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Dados Principais
  const [availableTypes, setAvailableTypes] = useState([]);
  const [savedLists, setSavedLists] = useState([]);
  
  // --- ESTADOS DA BUSCA ---
  const [searchCards, setSearchCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cardType, setCardType] = useState('');
  const [sortOrder, setSortOrder] = useState('released');
  const [sortDirection, setSortDirection] = useState('auto');
  const [colors, setColors] = useState({ W: false, U: false, B: false, R: false, G: false });
  const [showFilters, setShowFilters] = useState(true);

  // --- ESTADOS DA LISTA ABERTA ---
  const [selectedList, setSelectedList] = useState(null); 
  const [listCards, setListCards] = useState([]); 
  const [listViewFilter, setListViewFilter] = useState('all'); 
  const [listSortOrder, setListSortOrder] = useState('released');
  const [listSortDirection, setListSortDirection] = useState('auto');

  // --- AUTENTICAÇÃO E DADOS ---

  // 1. Monitorar Login
  useEffect(() => {
    if (!firebaseInitialized) return;
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserProfile(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronizar Listas (Local vs Nuvem)
  useEffect(() => {
    if (user && firebaseInitialized) {
      // MODO NUVEM: Escuta em tempo real do Firestore
      const listsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'lists');
      const unsubscribe = onSnapshot(listsRef, (snapshot) => {
        const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        lists.sort((a, b) => b.id - a.id);
        setSavedLists(lists);
      }, (error) => {
        console.error("Erro ao sincronizar listas:", error);
      });
      return () => unsubscribe();
    } else {
      // MODO LOCAL: Lê do LocalStorage
      const saved = localStorage.getItem('myScryfallLists');
      if (saved) setSavedLists(JSON.parse(saved));
    }
  }, [user]);

  // Carregar Perfil (Email de Recuperação)
  const loadUserProfile = async (uid) => {
    if (!firebaseInitialized) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'info');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRecoveryEmail(docSnap.data().recoveryEmail || '');
      }
    } catch (err) {
      console.error("Erro ao carregar perfil", err);
    }
  };

  // Login com Google
  const handleGoogleLogin = async () => {
    if (!firebaseInitialized) {
      showNotification("Firebase não configurado! Veja o topo do código.");
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotification("Login realizado com sucesso!");
    } catch (error) {
      console.error(error);
      showNotification("Erro ao fazer login.");
    }
  };

  // Logout
  const handleLogout = async () => {
    if (!firebaseInitialized) return;
    await signOut(auth);
    setSavedLists([]); // Limpa visualização atual
    setActiveTab('search');
    showNotification("Você saiu da conta.");
  };

  // Salvar Email de Recuperação
  const saveUserProfile = async () => {
    if (!user || !firebaseInitialized) return;
    setIsSavingProfile(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), {
        recoveryEmail: recoveryEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showNotification("Perfil atualizado!");
      setShowProfileModal(false);
    } catch (err) {
      console.error(err);
      showNotification("Erro ao salvar perfil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- CARREGAMENTO DE DADOS ESTATICOS ---
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const baseTypes = ['Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Land', 'Planeswalker'];
        const endpoints = [
          'https://api.scryfall.com/catalog/creature-types',
          'https://api.scryfall.com/catalog/artifact-types',
          'https://api.scryfall.com/catalog/enchantment-types',
          'https://api.scryfall.com/catalog/land-types',
          'https://api.scryfall.com/catalog/planeswalker-types',
          'https://api.scryfall.com/catalog/spell-types'
        ];
        const responses = await Promise.all(endpoints.map(url => fetch(url).then(res => res.ok ? res.json() : { data: [] })));
        const allSubtypes = responses.flatMap(r => r.data || []);
        const completeList = [...new Set([...baseTypes, ...allSubtypes])].sort();
        setAvailableTypes(completeList);
      } catch (err) {
        setAvailableTypes(['Creature', 'Artifact', 'Enchantment'].sort());
      }
    };
    fetchTypes();
  }, []);

  // --- FUNÇÕES AUXILIARES ---

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const buildQuery = (term, type, activeColors) => {
    let parts = [];
    if (term) parts.push(term);
    if (type) parts.push(`t:${type}`);
    const colorKeys = Object.keys(activeColors).filter(c => activeColors[c]);
    if (colorKeys.length > 0) parts.push(`c:${colorKeys.join('')}`);
    return parts.join(' ');
  };

  // --- LÓGICA DE AÇÃO (HÍBRIDA: LOCAL OU NUVEM) ---

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setSearchCards([]);

    const query = buildQuery(searchTerm, cardType, colors);
    if (!query) {
      setError("Digite um termo ou selecione filtros.");
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=${sortOrder}&dir=${sortDirection}`);
      if (!resp.ok) throw new Error(resp.status === 404 ? "Nenhuma carta encontrada." : "Erro na API.");
      const data = await resp.json();
      setSearchCards(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveList = async () => {
    if (searchCards.length === 0) return showNotification("Busque cartas antes de salvar.");
    const name = prompt("Nome da Lista:", `Lista ${savedLists.length + 1}`);
    if (!name) return;

    const newList = {
      id: Date.now().toString(),
      name,
      date: new Date().toLocaleDateString('pt-BR'),
      params: { searchTerm, cardType, colors, sortOrder, sortDirection },
      query: buildQuery(searchTerm, cardType, colors),
      acquiredIds: [],
      previewCards: searchCards.slice(0, 3).map(c => c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small),
    };

    if (user && firebaseInitialized) {
      // Salvar no Firestore
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lists', newList.id), newList);
        showNotification("Lista salva na nuvem!");
      } catch (e) {
        showNotification("Erro ao salvar na nuvem.");
      }
    } else {
      // Salvar Localmente
      const updated = [...savedLists, newList];
      setSavedLists(updated);
      localStorage.setItem('myScryfallLists', JSON.stringify(updated));
      showNotification(user ? "Erro de conexão, salvo localmente." : "Lista salva localmente (Offline).");
    }
    setActiveTab('lists');
  };

  const deleteList = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta lista?")) return;

    if (user && firebaseInitialized) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lists', id));
        showNotification("Lista excluída.");
      } catch (e) {
        showNotification("Erro ao excluir.");
      }
    } else {
      const updated = savedLists.filter(l => l.id !== id);
      setSavedLists(updated);
      localStorage.setItem('myScryfallLists', JSON.stringify(updated));
    }
    
    if (selectedList?.id === id) closeList();
  };

  const toggleAcquired = async (cardId) => {
    if (!selectedList) return;

    const currentAcquired = new Set(selectedList.acquiredIds || []);
    if (currentAcquired.has(cardId)) {
      currentAcquired.delete(cardId);
    } else {
      currentAcquired.add(cardId);
    }

    const updatedList = { ...selectedList, acquiredIds: Array.from(currentAcquired) };
    setSelectedList(updatedList);

    if (user && firebaseInitialized) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'lists', selectedList.id), updatedList, { merge: true });
      } catch (e) {
        console.error("Erro ao atualizar progresso na nuvem");
      }
    } else {
      const allListsUpdated = savedLists.map(l => l.id === updatedList.id ? updatedList : l);
      setSavedLists(allListsUpdated);
      localStorage.setItem('myScryfallLists', JSON.stringify(allListsUpdated));
    }
  };

  const openList = (list) => {
    setSelectedList(list);
    const initialSort = list.params?.sortOrder || list.sort || 'released';
    const initialDir = list.params?.sortDirection || list.params?.dir || list.dir || 'auto';
    setListSortOrder(initialSort); 
    setListSortDirection(initialDir);
    setActiveTab('details');
    fetchListCards(list, initialSort, initialDir);
  };

  const closeList = () => {
    setSelectedList(null);
    setListCards([]);
    setActiveTab('lists');
  };

  const fetchListCards = async (list, orderOverride = null, dirOverride = null) => {
    setLoading(true);
    setListCards([]);
    try {
      const order = orderOverride || listSortOrder;
      const dir = dirOverride || listSortDirection || 'auto';
      const resp = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(list.query)}&order=${order}&dir=${dir}`);
      if (!resp.ok) throw new Error("Erro ao carregar lista.");
      const data = await resp.json();
      setListCards(data.data || []);
    } catch (err) {
      showNotification("Erro ao carregar cartas.");
    } finally {
      setLoading(false);
    }
  };

  // --- COMPONENTES UI ---
  const CardGrid = ({ cardsData, isInteractiveList = false }) => {
    const filteredCards = cardsData.filter(card => {
      if (!isInteractiveList) return true;
      const isAcquired = selectedList?.acquiredIds?.includes(card.id);
      if (listViewFilter === 'acquired') return isAcquired;
      if (listViewFilter === 'missing') return !isAcquired;
      return true;
    });

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
        {filteredCards.map((card) => {
          const imgUrl = card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
          const isAcquired = isInteractiveList && selectedList?.acquiredIds?.includes(card.id);
          return (
            <div 
              key={card.id} 
              className={`relative bg-slate-800 rounded-lg overflow-hidden transition-all duration-200 shadow-md flex flex-col ${isInteractiveList ? 'cursor-pointer' : ''} ${isAcquired ? 'ring-2 ring-green-500 bg-slate-900' : 'hover:scale-[1.02]'}`}
              onClick={() => isInteractiveList && toggleAcquired(card.id)}
            >
              {isInteractiveList && (
                <div className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-colors ${isAcquired ? 'bg-green-500 text-white' : 'bg-black/50 text-white/30 hover:bg-black/70'}`}>
                  <Check size={18} strokeWidth={3} />
                </div>
              )}
              <div className={`relative aspect-[2.5/3.5] bg-slate-900 ${isInteractiveList && !isAcquired ? 'opacity-85' : 'opacity-100'}`}>
                {imgUrl ? <img src={imgUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="flex items-center justify-center h-full text-slate-500"><ImageIcon size={40} /></div>}
              </div>
              <div className="p-3 flex flex-col flex-grow">
                <h4 className={`font-bold text-sm leading-tight mb-1 ${isAcquired ? 'text-green-400' : 'text-white'}`}>{card.name}</h4>
                <p className="text-slate-400 text-xs mb-2">{card.type_line}</p>
                <div className="mt-auto flex justify-between items-center border-t border-slate-700 pt-2">
                  <span className="text-xs text-purple-300 font-mono">{card.set?.toUpperCase()}</span>
                  <div className="flex gap-2">
                    {card.prices?.usd && <span className="text-xs text-green-200">${card.prices.usd}</span>}
                    <a href={card.scryfall_uri} target="_blank" onClick={(e) => e.stopPropagation()} className="text-slate-400 hover:text-white"><ExternalLink size={14} /></a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      
      {/* --- AVISO DE CONFIGURAÇÃO FALTANDO --- */}
      {!firebaseInitialized && (
        <div className="bg-orange-600 text-white p-3 text-center text-sm font-bold flex items-center justify-center gap-2">
          <AlertTriangle size={18} />
          <span>Modo Offline: Para habilitar o Login, configure as chaves do Firebase no arquivo App.jsx</span>
        </div>
      )}

      {/* --- MODAL DE PERFIL --- */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><User /> Perfil do Usuário</h2>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">Conta Google Conectada</label>
              <div className="bg-slate-900 p-3 rounded text-white flex items-center gap-2">
                <img src={user?.photoURL} className="w-6 h-6 rounded-full" alt="User" />
                {user?.email}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-1">E-mail de Recuperação / Secundário</label>
              <div className="flex items-center gap-2 bg-slate-900 rounded border border-slate-700 focus-within:border-purple-500">
                <Mail className="ml-3 text-slate-500" size={18} />
                <input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="exemplo@recuperacao.com" className="bg-transparent w-full p-3 text-white focus:outline-none"/>
              </div>
              <p className="text-xs text-slate-500 mt-2">Este e-mail será usado caso percamos contato com sua conta principal.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
              <button onClick={saveUserProfile} disabled={isSavingProfile} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold">
                {isSavingProfile ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 px-4 py-3 shadow-md">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Search size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden md:block">
              Scryfall Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {activeTab !== 'details' && (
              <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                <button onClick={() => setActiveTab('search')} className={`px-3 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-colors ${activeTab === 'search' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Busca</button>
                <button onClick={() => setActiveTab('lists')} className={`px-3 md:px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-colors ${activeTab === 'lists' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Listas</button>
              </div>
            )}
            {activeTab === 'details' && (
               <button onClick={closeList} className="flex items-center gap-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors text-sm"><ArrowLeft size={16} /> Voltar</button>
            )}
            {/* User Area */}
            {user && firebaseInitialized ? (
              <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                <button onClick={() => setShowProfileModal(true)} title="Meu Perfil" className="w-8 h-8 rounded-full overflow-hidden border border-slate-600 hover:border-purple-400 transition-colors"><img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="User" /></button>
                <button onClick={handleLogout} title="Sair" className="text-slate-400 hover:text-red-400"><LogOut size={18} /></button>
              </div>
            ) : (
              <button onClick={handleGoogleLogin} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-bold transition-colors ${firebaseInitialized ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`} title={!firebaseInitialized ? "Configure o Firebase para logar" : ""}>
                Login Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {notification && <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-xl z-50 animate-bounce">{notification}</div>}

        {activeTab === 'search' && (
          <div className="animate-fade-in">
            <div className="bg-slate-800 p-4 rounded-lg shadow-lg mb-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
                <h3 className="text-purple-400 font-bold flex items-center gap-2"><Filter size={18} /> Filtros de Busca</h3>
                {showFilters ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
              </div>
              {showFilters && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-1">Nome</label>
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Ex: Sol Ring" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Tipo</label>
                      <input type="text" list="types" value={cardType} onChange={(e) => setCardType(e.target.value)} placeholder="Ex: Dragon, Artifact..." className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                      <datalist id="types">{availableTypes.map(t => <option key={t} value={t} />)}</datalist>
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Ordenar</label>
                      <div className="flex gap-2">
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="flex-grow bg-slate-900 border border-slate-700 rounded p-2 text-white"><option value="released">Lançamento</option><option value="name">Nome</option><option value="cmc">Mana (CMC)</option><option value="usd">Preço (USD)</option></select>
                        <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)} className="w-32 bg-slate-900 border border-slate-700 rounded p-2 text-white"><option value="auto">Auto</option><option value="asc">Cresc.</option><option value="desc">Decresc.</option></select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Cores</label>
                    <div className="flex gap-3">
                      {['W','U','B','R','G'].map(c => (
                        <label key={c} className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-2 ${colors[c] ? 'border-white opacity-100 scale-110' : 'border-transparent opacity-40'} ${c === 'W' ? 'bg-yellow-100 text-black' : c === 'U' ? 'bg-blue-600' : c === 'B' ? 'bg-gray-800' : c === 'R' ? 'bg-red-600' : 'bg-green-600'}`}>
                          <input type="checkbox" checked={colors[c]} onChange={() => setColors({...colors, [c]: !colors[c]})} className="hidden" />
                          <span className="font-bold text-xs">{c}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleSearch} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    {loading ? "Buscando..." : <><Search size={20} /> Buscar Cartas</>}
                  </button>
                </div>
              )}
            </div>
            {searchCards.length > 0 && (
              <div className="flex justify-between items-center mb-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-sm text-slate-400">Resultados: <strong className="text-white">{searchCards.length}</strong></span>
                <button onClick={saveList} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><Save size={16} /> Criar Lista</button>
              </div>
            )}
            <CardGrid cardsData={searchCards} />
          </div>
        )}

        {activeTab === 'lists' && (
          <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2"><List className="text-purple-400" /> {user ? 'Listas na Nuvem' : 'Listas Locais'}</h2>
              {!user && <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-1 rounded">Faça login para salvar na nuvem</span>}
            </div>
            {savedLists.length === 0 ? (
              <div className="text-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-lg">Nenhuma lista encontrada.</div>
            ) : (
              savedLists.map(list => {
                const acquiredCount = list.acquiredIds?.length || 0;
                const totalEstimated = listCards.length > 0 && selectedList?.id === list.id ? listCards.length : (list.cardCount || '?');
                const progress = totalEstimated !== '?' ? Math.round((acquiredCount / totalEstimated) * 100) : 0;
                return (
                  <div key={list.id} onClick={() => openList(list)} className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg p-4 cursor-pointer transition-colors group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">{list.name}</h3>
                        <div className="flex items-center gap-2 mt-1"><span className="text-xs text-slate-400">{list.date}</span><span className="text-xs bg-slate-900 px-2 py-0.5 rounded text-purple-300 font-mono truncate max-w-[200px]">{list.query}</span></div>
                        <div className="mt-3 flex items-center gap-2"><div className="w-32 h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${progress}%` }}></div></div><span className="text-xs text-green-400 font-bold">{acquiredCount} adquiridas</span></div>
                      </div>
                      <button onClick={(e) => deleteList(list.id, e)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-900 rounded"><Trash2 size={18} /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {activeTab === 'details' && selectedList && (
          <div className="animate-fade-in">
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg mb-6 border border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-600"></div>
              <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedList.name}</h2>
                  <div className="flex items-center gap-3 text-sm text-slate-400"><span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">Query: {selectedList.query}</span><span>Criada em: {selectedList.date}</span></div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 min-w-[200px]">
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Progresso</span><span className="text-white font-bold">{Math.round((selectedList.acquiredIds.length / (listCards.length || 1)) * 100)}%</span></div>
                  <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500" style={{ width: `${(selectedList.acquiredIds.length / (listCards.length || 1)) * 100}%` }}></div></div>
                  <div className="flex justify-between text-xs mt-2 text-slate-500"><span>{selectedList.acquiredIds.length} Adquiridas</span><span>{listCards.length - selectedList.acquiredIds.length} Faltam</span></div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex bg-slate-900 p-1 rounded-lg">
                  {[{ id: 'all', label: 'Todas' }, { id: 'acquired', label: 'Já Tenho' }, { id: 'missing', label: 'Faltam' }].map(opt => (
                    <button key={opt.id} onClick={() => setListViewFilter(opt.id)} className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${listViewFilter === opt.id ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{opt.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Ordem:</span>
                  <select value={listSortOrder} onChange={(e) => { setListSortOrder(e.target.value); fetchListCards(selectedList, e.target.value, listSortDirection); }} className="bg-slate-900 border border-slate-700 text-white text-sm rounded p-1.5 focus:outline-none focus:border-purple-500"><option value="released">Lançamento</option><option value="name">Nome (A-Z)</option><option value="cmc">Custo de Mana</option><option value="usd">Preço (USD)</option></select>
                  <select value={listSortDirection} onChange={(e) => { setListSortDirection(e.target.value); fetchListCards(selectedList, listSortOrder, e.target.value); }} className="w-32 bg-slate-900 border border-slate-700 text-white text-sm rounded p-1.5 focus:outline-none focus:border-purple-500"><option value="auto">Auto</option><option value="asc">Cresc.</option><option value="desc">Decresc.</option></select>
                </div>
              </div>
            </div>
            {loading ? <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-purple-500 mx-auto mb-4"></div><p className="text-slate-500">Sincronizando lista...</p></div> : <CardGrid cardsData={listCards} isInteractiveList={true} />}
          </div>
        )}
      </main>
    </div>
  );
}