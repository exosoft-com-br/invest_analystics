import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { calculateSMA, calculateRSI } from '../services/indicators';
import type { Stock, MarketData, Signal, ChartDataPoint } from '../types';
import PriceChart from '../components/PriceChart';
import SignalBadge from '../components/SignalBadge';

export default function StockDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [stock, setStock]         = useState<Stock | null>(null);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [signals, setSignals]     = useState<Signal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => { if (id) loadDetails(id); }, [id]);

  async function loadDetails(stockId: string) {
    try {
      setLoading(true); setError(null);
      const [stockRes, dataRes, sigRes] = await Promise.all([
        supabase.from('stocks').select('*').eq('id', stockId).single(),
        supabase.from('market_data').select('*').eq('stock_id', stockId).order('date', { ascending: true }).limit(100),
        supabase.from('signals').select('*').eq('stock_id', stockId).order('created_at', { ascending: false }).limit(20),
      ]);
      if (stockRes.error) throw new Error(stockRes.error.message);
      if (dataRes.error)  throw new Error(dataRes.error.message);
      if (sigRes.error)   console.warn('Signals query error:', sigRes.error.message);
      setStock(stockRes.data as Stock);
      setMarketData((dataRes.data ?? []) as MarketData[]);
      setSignals((sigRes.data ?? []) as Signal[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const closes   = marketData.map(d => d.close);
  const sma20arr = calculateSMA(closes, 20);
  const sma50arr = calculateSMA(closes, 50);
  const rsiarr   = calculateRSI(closes, 14);

  const chartData: ChartDataPoint[] = marketData.map((d, i) => ({
    date:  d.date,
    close: d.close,
    sma20: isFinite(sma20arr[i]) ? sma20arr[i] : null,
    sma50: isFinite(sma50arr[i]) ? sma50arr[i] : null,
  }));

  const latestData = marketData.at(-1) ?? null;
  const latestRSI  = [...rsiarr].reverse().find((v): v is number => isFinite(v)) ?? null;

  const changePercent = latestData && latestData.open !== 0
    ? ((latestData.close - latestData.open) / latestData.open) * 100
    : null;
  const isPositive = changePercent !== null && changePercent >= 0;

  // RSI gauge colour
  const rsiColor = latestRSI == null ? 'text-gray-400'
    : latestRSI < 30 ? 'text-emerald-400'
    : latestRSI > 70 ? 'text-red-400'
    : 'text-yellow-400';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Carregando dados...</span>
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-5xl">😕</p>
        <p className="text-red-400 font-medium">{error ?? 'Ação não encontrada.'}</p>
        <button onClick={() => navigate('/dashboard')}
          className="text-sm text-blue-400 hover:text-blue-300 border border-blue-900 rounded-lg px-4 py-2 transition-colors">
          ← Voltar ao Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <header className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur border-b border-gray-800/60 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')}
          className="text-gray-500 hover:text-white transition-colors text-sm flex items-center gap-1">
          ← Dashboard
        </button>
        <span className="text-gray-800">|</span>
        <span className="font-extrabold text-white tracking-tight">{stock.symbol}</span>
        <span className="text-gray-500 text-sm hidden sm:block">{stock.name}</span>
        {stock.sector && (
          <span className="hidden sm:block text-[11px] text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full ml-auto">
            {stock.sector}
          </span>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Hero price */}
        {latestData && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div>
              <p className="text-4xl font-extrabold font-mono text-white">
                ${latestData.close.toFixed(2)}
              </p>
              {changePercent !== null && (
                <p className={`mt-1 text-sm font-semibold flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
                  <span className="text-gray-600 font-normal text-xs">hoje ({latestData.date})</span>
                </p>
              )}
            </div>
            <div className="sm:ml-auto flex flex-wrap gap-2">
              {signals[0] && <SignalBadge signal={signals[0]} />}
              {latestRSI != null && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-gray-700 bg-gray-800 ${rsiColor}`}>
                  RSI {latestRSI.toFixed(1)}
                  <span className="text-gray-500 font-normal">
                    {latestRSI < 30 ? '· Sobrevendido' : latestRSI > 70 ? '· Sobrecomprado' : '· Neutro'}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* KPI grid */}
        {latestData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Abertura',  value: `$${latestData.open.toFixed(2)}`,  sub: null },
              { label: 'Máxima',    value: `$${latestData.high.toFixed(2)}`,  sub: null },
              { label: 'Mínima',    value: `$${latestData.low.toFixed(2)}`,   sub: null },
              { label: 'Volume',    value: `${(latestData.volume / 1_000_000).toFixed(2)}M`, sub: 'negociado' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                <p className="text-lg font-extrabold font-mono">{kpi.value}</p>
                {kpi.sub && <p className="text-[10px] text-gray-600 mt-0.5">{kpi.sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <PriceChart data={chartData} symbol={stock.symbol} />

        {/* Signals table */}
        <div>
          <h2 className="text-base font-bold mb-3 text-gray-300 uppercase tracking-wider">
            Histórico de Sinais
          </h2>
          {signals.length === 0 ? (
            <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
              <p className="text-3xl mb-2">🔭</p>
              <p className="text-gray-500 text-sm">Nenhum sinal gerado ainda para esta ação.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-500 text-[11px] uppercase tracking-wider">
                    {['Tipo','Preço','Indicador','RSI','SMA 20','SMA 50','Data'].map(h => (
                      <th key={h} className={`px-4 py-3 font-semibold ${h === 'Tipo' || h === 'Indicador' || h === 'Data' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {signals.map((sig, idx) => (
                    <tr key={sig.id}
                      className={`transition-colors hover:bg-gray-800/50 ${idx === 0 ? 'bg-gray-900/80' : 'bg-gray-950'}`}>
                      <td className="px-4 py-3"><SignalBadge signal={sig} /></td>
                      <td className="px-4 py-3 text-right font-mono text-white">${sig.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{sig.indicator}</td>
                      <td className={`px-4 py-3 text-right font-mono text-xs ${
                        sig.rsi_value != null && sig.rsi_value < 30 ? 'text-emerald-400'
                        : sig.rsi_value != null && sig.rsi_value > 70 ? 'text-red-400'
                        : 'text-gray-400'}`}>
                        {sig.rsi_value != null ? sig.rsi_value.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400 text-xs">
                        {sig.sma20 != null ? `$${sig.sma20.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-400 text-xs">
                        {sig.sma50 != null ? `$${sig.sma50.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {sig.created_at ? new Date(sig.created_at).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
