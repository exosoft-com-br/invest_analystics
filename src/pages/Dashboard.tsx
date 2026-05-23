import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { signOut } from '../services/auth';
import type { Stock, MarketData, Signal } from '../types';
import StockCard from '../components/StockCard';

type StockSummary = {
  stock: Stock;
  latestData: MarketData | null;
  latestSignal: Signal | null;
  recentCloses: number[];
};

const ALL_SECTORS = 'Todos';

export default function Dashboard() {
  const [summaries, setSummaries] = useState<StockSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [sector, setSector]       = useState(ALL_SECTORS);
  const [search, setSearch]       = useState('');

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      const { data: stocks, error: stockErr } = await supabase
        .from('stocks').select('*').eq('active', true).order('symbol');
      if (stockErr) throw new Error(stockErr.message);
      if (!stocks || stocks.length === 0) { setSummaries([]); return; }

      const results = await Promise.all(
        (stocks as Stock[]).map(async (stock) => {
          const [marketRes, signalRes, histRes] = await Promise.all([
            supabase.from('market_data').select('*')
              .eq('stock_id', stock.id).order('date', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('signals').select('*')
              .eq('stock_id', stock.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('market_data').select('close,date')
              .eq('stock_id', stock.id).order('date', { ascending: false }).limit(20),
          ]);
          const closes = ((histRes.data ?? []) as { close: number }[])
            .map(r => r.close).reverse();
          return {
            stock,
            latestData:   marketRes.data as MarketData | null,
            latestSignal: signalRes.data as Signal | null,
            recentCloses: closes,
          };
        }),
      );
      setSummaries(results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const handleSignOut = async () => { try { await signOut(); } catch { /**/ } };

  // Derived stats
  const buyCount  = summaries.filter(s => s.latestSignal?.type === 'BUY').length;
  const sellCount = summaries.filter(s => s.latestSignal?.type === 'SELL').length;
  const sectors   = [ALL_SECTORS, ...Array.from(new Set(summaries.map(s => s.stock.sector ?? ''))).filter(Boolean).sort()];

  const filtered = summaries.filter(s => {
    const matchSector = sector === ALL_SECTORS || s.stock.sector === sector;
    const matchSearch = s.stock.symbol.includes(search.toUpperCase()) ||
                        s.stock.name.toLowerCase().includes(search.toLowerCase());
    return matchSector && matchSearch;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur border-b border-gray-800/60 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-gradient">📈 InvestAnalytics</span>
          <span className="hidden sm:block text-xs text-gray-600 border border-gray-800 rounded px-2 py-0.5">POC</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xs font-medium text-gray-300 transition-colors border border-gray-700"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            Atualizar
          </button>
          <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-white transition-colors">
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ações monitoradas', value: summaries.length, icon: '📊', color: 'text-blue-400'    },
            { label: 'Sinais BUY',         value: buyCount,          icon: '▲',   color: 'text-emerald-400'},
            { label: 'Sinais SELL',        value: sellCount,         icon: '▼',   color: 'text-red-400'   },
            { label: 'Sem sinal',          value: summaries.length - buyCount - sellCount, icon: '—', color: 'text-gray-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-2xl font-extrabold font-mono animate-count ${stat.color}`}>
                {loading ? '—' : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Sector filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por símbolo ou nome..."
            className="flex-1 px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {sectors.map(s => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                  sector === s
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-2xl h-44 animate-pulse border border-gray-800" />
            ))}
          </div>
        )}

        {/* Cards grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(({ stock, latestData, latestSignal, recentCloses }) => (
              <StockCard
                key={stock.id}
                stock={stock}
                latestData={latestData}
                latestSignal={latestSignal}
                recentCloses={recentCloses}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && !error && (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-400 text-lg font-semibold">Nenhuma ação encontrada</p>
            <p className="text-gray-600 text-sm mt-1">
              {summaries.length === 0
                ? <>Execute <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">npm run fetch-data</code> para popular o banco.</>
                : 'Tente ajustar o filtro ou a busca.'}
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-700 pb-4">
          Dados: Alpha Vantage · Banco: Supabase · POC — apenas fins educacionais
        </p>
      </main>
    </div>
  );
}
