import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Modal, Input, InputNumber, Button, Space, message, Spin } from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  RocketOutlined,
  SettingOutlined,
} from '@ant-design/icons';

// ============ Types ============
interface StockItem {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  changeAmount: number;
  volume: number;
  turnover: number;
  amplitude: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

interface StockHolding {
  code: string;
  name: string;
  marketType: string;
  buyPrice: number;
  quantity: number;
}

type MarketType = 'A' | 'US' | 'HK';

// ============ Constants ============
const STORAGE_KEY = 'wms_stock_holdings_v2';
const DEEPSEEK_KEY_STORAGE = 'wms_deepseek_key';
const COLOR_UP = '#00ff41';
const COLOR_DOWN = '#ff0040';
const COLOR_FLAT = '#555';
const BG_PRIMARY = '#000000';
const BG_ROW_HOVER = '#0a1a0a';
const BORDER_COLOR = '#003300';
const GLOW_GREEN = '0 0 10px #00ff41, 0 0 20px #00ff4133';
const GLOW_RED = '0 0 10px #ff0040, 0 0 20px #ff004033';

// ============ API Functions ============
const MARKET_URLS: Record<MarketType, string> = {
  A: `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f4,f5,f6,f7,f12,f14,f15,f16,f17,f18`,
  US: `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=200&po=1&np=1&fltt=2&invt=2&fs=m:105,m:106,m:107&fields=f2,f3,f4,f5,f6,f7,f12,f14,f15,f16,f17,f18`,
  HK: `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=500&po=1&np=1&fltt=2&invt=2&fs=m:128+t:3,m:128+t:4,m:128+t:1,m:128+t:2&fields=f2,f3,f4,f5,f6,f7,f12,f14,f15,f16,f17,f18`,
};

async function fetchStocks(market: MarketType): Promise<StockItem[]> {
  try {
    const res = await fetch(MARKET_URLS[market]);
    const json = await res.json();
    if (!json.data?.diff) return [];
    return json.data.diff.map((d: Record<string, unknown>) => ({
      code: d.f12 as string,
      name: d.f14 as string,
      price: d.f2 as number,
      changePercent: d.f3 as number,
      changeAmount: d.f4 as number,
      volume: d.f5 as number,
      turnover: d.f6 as number,
      amplitude: d.f7 as number,
      high: d.f15 as number,
      low: d.f16 as number,
      open: d.f17 as number,
      prevClose: d.f18 as number,
    })).filter((s: StockItem) => s.price > 0);
  } catch {
    return [];
  }
}

async function fetchSingleQuote(code: string, marketType: string): Promise<{ price: number; changePercent: number; name: string } | null> {
  let secid = '';
  if (marketType === 'A') secid = `${code.startsWith('6') ? 1 : 0}.${code}`;
  else if (marketType === 'US') secid = `105.${code}`;
  else if (marketType === 'HK') secid = `128.${code}`;
  try {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f170`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.data) return null;
    return { price: json.data.f43 / 100, changePercent: json.data.f170 / 100, name: json.data.f58 };
  } catch {
    return null;
  }
}

async function analyzeWithDeepSeek(apiKey: string, topStocks: StockItem[], market: string): Promise<string> {
  const marketName = market === 'A' ? 'A股' : market === 'US' ? '美股' : '港股';
  const stockInfo = topStocks.map(s => `${s.name}(${s.code}) 现价:${s.price} 涨幅:${s.changePercent}% 成交额:${(s.turnover / 100000000).toFixed(2)}亿`).join('\n');
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `你是一位资深${marketName}分析师。以下是今日${marketName}涨幅前20的股票数据：\n\n${stockInfo}\n\n请从中选出3-5只最具潜力的股票，对每只股票给出：\n1. 推荐理由（技术面+基本面）\n2. 该公司的发展历史（成立时间、主营业务、重大事件）\n3. 近期走势分析\n4. 风险提示\n\n请用中文详细回答，格式清晰。` }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '分析失败，请稍后重试';
}

// ============ Mini Sparkline Component ============
function Sparkline({ changePercent, amplitude }: { changePercent: number; amplitude: number }) {
  const isUp = changePercent >= 0;
  const color = isUp ? COLOR_UP : COLOR_DOWN;
  // Generate a pseudo-random sparkline based on change and amplitude
  const points: number[] = [];
  const seed = Math.abs(changePercent * 100 + amplitude * 10);
  for (let i = 0; i < 12; i++) {
    const noise = Math.sin(seed + i * 1.5) * 0.3 + Math.cos(seed * 0.7 + i) * 0.2;
    const trend = isUp ? (i / 11) * 0.6 : (1 - i / 11) * 0.6;
    points.push(Math.max(0.1, Math.min(0.9, 0.5 + trend + noise)));
  }
  const w = 60, h = 20;
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i / 11) * w} ${h - p * h}`).join(' ');

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`grad-${isUp ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathData} L ${w} ${h} L 0 ${h} Z`} fill={`url(#grad-${isUp ? 'up' : 'down'})`} />
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" style={{ filter: `drop-shadow(${isUp ? GLOW_GREEN.split(',')[0] : GLOW_RED.split(',')[0]})` }} />
    </svg>
  );
}

// ============ Matrix Rain Background ============
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const cols = Math.floor(canvas.width / 14);
    const drops: number[] = Array(cols).fill(1);
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ$¥€£₿';
    let animId: number;
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff4115';
      ctx.font = '12px monospace';
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * 14, drops[i] * 14);
        if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.4 }} />;
}

// ============ Styles ============
const matrixStyles = `
  .matrix-panel ::-webkit-scrollbar { width: 4px; }
  .matrix-panel ::-webkit-scrollbar-track { background: #000; }
  .matrix-panel ::-webkit-scrollbar-thumb { background: #003300; border-radius: 2px; }
  .matrix-panel ::-webkit-scrollbar-thumb:hover { background: #005500; }
  .matrix-panel .ant-input { background: #000 !important; border-color: #003300 !important; color: #00ff41 !important; font-family: 'Courier New', monospace !important; }
  .matrix-panel .ant-input-number { background: #000 !important; border-color: #003300 !important; color: #00ff41 !important; }
  .matrix-panel .ant-input-number-input { color: #00ff41 !important; font-family: 'Courier New', monospace !important; }
  .matrix-panel .ant-btn-default { border-color: #003300 !important; color: #00ff41 !important; background: #000 !important; }
  .matrix-panel .ant-btn-default:hover { border-color: #00ff41 !important; box-shadow: 0 0 10px #00ff4133 !important; }
  .matrix-panel .ant-modal-close { color: #00ff41 !important; }
  .matrix-panel .ant-input-affix-wrapper { background: #000 !important; border-color: #003300 !important; }
  .matrix-panel .ant-input-prefix { color: #005500 !important; }
  .matrix-panel .stock-row:hover { background: ${BG_ROW_HOVER} !important; }
  @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
  @keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.98; } }
  @keyframes glow-pulse { 0%, 100% { text-shadow: 0 0 5px currentColor; } 50% { text-shadow: 0 0 15px currentColor, 0 0 30px currentColor; } }
`;

// ============ Main Component ============
interface StockPanelProps { open: boolean; onClose: () => void; }

export default function StockPanel({ open, onClose }: StockPanelProps) {
  const [market, setMarket] = useState<MarketType>('A');
  const [allStocks, setAllStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'changePercent' | 'turnover'>('changePercent');
  const [sortDesc, setSortDesc] = useState(true);
  const [activeTab, setActiveTab] = useState<'market' | 'holdings' | 'ai'>('market');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Holdings
  const [holdings, setHoldings] = useState<StockHolding[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [holdingQuotes, setHoldingQuotes] = useState<Record<string, { price: number; changePercent: number }>>({});
  const [newCode, setNewCode] = useState('');
  const [newBuyPrice, setNewBuyPrice] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState<number | null>(null);
  const [newMarketType, setNewMarketType] = useState<MarketType>('A');

  // DeepSeek
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem(DEEPSEEK_KEY_STORAGE) || '');
  const [keyInput, setKeyInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)); }, [holdings]);

  const loadStocks = useCallback(async () => {
    setLoading(true);
    const data = await fetchStocks(market);
    if (data.length > 0) setAllStocks(data);
    setLoading(false);
  }, [market]);

  useEffect(() => {
    if (open) { loadStocks(); timerRef.current = setInterval(loadStocks, 15000); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, loadStocks]);

  useEffect(() => {
    if (!open || holdings.length === 0) return;
    const refresh = async () => {
      const results: Record<string, { price: number; changePercent: number }> = {};
      await Promise.all(holdings.map(async (h) => {
        const q = await fetchSingleQuote(h.code, h.marketType);
        if (q) results[h.code] = { price: q.price, changePercent: q.changePercent };
      }));
      setHoldingQuotes(results);
    };
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [open, holdings]);

  const displayStocks = useMemo(() => {
    let list = [...allStocks];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(item => item.code.toLowerCase().includes(s) || item.name.toLowerCase().includes(s));
    }
    list.sort((a, b) => sortDesc ? (b[sortBy] - a[sortBy]) : (a[sortBy] - b[sortBy]));
    return list;
  }, [allStocks, search, sortBy, sortDesc]);

  const handleAddHolding = async () => {
    if (!newCode || !newBuyPrice || !newQuantity) { message.warning('请填写完整信息'); return; }
    if (holdings.find(h => h.code === newCode)) { message.warning('该股票已存在'); return; }
    const q = await fetchSingleQuote(newCode, newMarketType);
    if (!q) { message.error('无法获取该股票信息'); return; }
    setHoldings([...holdings, { code: newCode, name: q.name, marketType: newMarketType, buyPrice: newBuyPrice, quantity: newQuantity }]);
    setHoldingQuotes(prev => ({ ...prev, [newCode]: { price: q.price, changePercent: q.changePercent } }));
    setNewCode(''); setNewBuyPrice(null); setNewQuantity(null);
    message.success(`已添加 ${q.name}`);
  };

  const handleAnalyze = async () => {
    if (!deepseekKey) { message.warning('请先设置 DeepSeek API Key'); return; }
    setAiLoading(true);
    try {
      const top20 = [...allStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 20);
      const result = await analyzeWithDeepSeek(deepseekKey, top20, market);
      setAiResult(result);
    } catch { message.error('AI 分析失败'); }
    setAiLoading(false);
  };

  const saveKey = () => {
    if (!keyInput.trim()) return;
    setDeepseekKey(keyInput.trim());
    localStorage.setItem(DEEPSEEK_KEY_STORAGE, keyInput.trim());
    setKeyInput('');
    message.success('API Key 已保存');
  };

  const getColor = (val: number) => val > 0 ? COLOR_UP : val < 0 ? COLOR_DOWN : COLOR_FLAT;
  const marketLabel = { A: 'A股', US: '美股', HK: '港股' };

  // ============ Market Selector ============
  const MarketSelector = (
    <div style={{ display: 'flex', gap: 2, marginBottom: 12 }}>
      {(['A', 'US', 'HK'] as MarketType[]).map(m => (
        <button key={m} onClick={() => setMarket(m)} style={{
          padding: '6px 16px', border: `1px solid ${market === m ? COLOR_UP : BORDER_COLOR}`,
          background: market === m ? '#001a00' : 'transparent', color: market === m ? COLOR_UP : '#555',
          fontFamily: '"Courier New", monospace', fontSize: 13, cursor: 'pointer', fontWeight: market === m ? 700 : 400,
          textShadow: market === m ? `0 0 10px ${COLOR_UP}` : 'none', transition: 'all 0.3s',
        }}>
          [{marketLabel[m]}]
        </button>
      ))}
    </div>
  );

  // ============ Tab Selector ============
  const TabSelector = (
    <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${BORDER_COLOR}` }}>
      {([['market', '> 实时行情'], ['holdings', '> 我的持仓'], ['ai', '> 潜力股分析']] as const).map(([key, label]) => (
        <button key={key} onClick={() => setActiveTab(key)} style={{
          padding: '8px 20px', border: 'none', borderBottom: activeTab === key ? `2px solid ${COLOR_UP}` : '2px solid transparent',
          background: 'transparent', color: activeTab === key ? COLOR_UP : '#555',
          fontFamily: '"Courier New", monospace', fontSize: 13, cursor: 'pointer',
          textShadow: activeTab === key ? `0 0 8px ${COLOR_UP}` : 'none',
        }}>
          {label}
        </button>
      ))}
    </div>
  );

  // ============ Market Tab Content ============
  const MarketContent = (
    <div style={{ height: 'calc(85vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <Input prefix={<SearchOutlined />} placeholder="搜索代码/名称..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180 }} allowClear />
        <button onClick={() => { setSortBy('changePercent'); setSortDesc(true); }} style={{ padding: '4px 10px', border: `1px solid ${sortBy === 'changePercent' && sortDesc ? COLOR_UP : BORDER_COLOR}`, background: sortBy === 'changePercent' && sortDesc ? '#001a00' : 'transparent', color: sortBy === 'changePercent' && sortDesc ? COLOR_UP : '#555', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}>涨幅+</button>
        <button onClick={() => { setSortBy('changePercent'); setSortDesc(false); }} style={{ padding: '4px 10px', border: `1px solid ${sortBy === 'changePercent' && !sortDesc ? COLOR_DOWN : BORDER_COLOR}`, background: sortBy === 'changePercent' && !sortDesc ? '#1a0000' : 'transparent', color: sortBy === 'changePercent' && !sortDesc ? COLOR_DOWN : '#555', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}>跌幅+</button>
        <button onClick={() => { setSortBy('turnover'); setSortDesc(true); }} style={{ padding: '4px 10px', border: `1px solid ${sortBy === 'turnover' ? '#ffab00' : BORDER_COLOR}`, background: sortBy === 'turnover' ? '#1a1500' : 'transparent', color: sortBy === 'turnover' ? '#ffab00' : '#555', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}>成交额</button>
        <span style={{ marginLeft: 'auto', color: '#333', fontSize: 11, fontFamily: 'monospace' }}>
          TOTAL: {allStocks.length} | {loading ? 'LOADING...' : 'LIVE'}
        </span>
        <Button size="small" icon={<ReloadOutlined />} onClick={loadStocks} loading={loading} />
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '75px 100px 80px 80px 80px 70px 90px', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${BORDER_COLOR}`, fontSize: 11, color: '#335533', fontFamily: 'monospace', textTransform: 'uppercase' }}>
        <span>CODE</span><span>NAME</span><span>PRICE</span><span>CHG%</span><span>CHG</span><span>TREND</span><span>VOL</span>
      </div>
      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: 2 }}>
        {displayStocks.map(stock => (
          <div key={stock.code} className="stock-row" style={{ display: 'grid', gridTemplateColumns: '75px 100px 80px 80px 80px 70px 90px', gap: 4, padding: '5px 10px', borderBottom: `1px solid #0a0a0a`, fontSize: 12, alignItems: 'center', fontFamily: '"Courier New", monospace', transition: 'background 0.2s' }}>
            <span style={{ color: '#00aa30' }}>{stock.code}</span>
            <span style={{ color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</span>
            <span style={{ color: getColor(stock.changePercent) }}>{stock.price.toFixed(2)}</span>
            <span style={{ color: getColor(stock.changePercent), fontWeight: 700, textShadow: `0 0 6px ${getColor(stock.changePercent)}44` }}>{stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
            <span style={{ color: getColor(stock.changeAmount) }}>{stock.changeAmount > 0 ? '+' : ''}{stock.changeAmount.toFixed(2)}</span>
            <Sparkline changePercent={stock.changePercent} amplitude={stock.amplitude} />
            <span style={{ color: '#444' }}>{stock.turnover > 100000000 ? (stock.turnover / 100000000).toFixed(1) + 'B' : (stock.turnover / 10000).toFixed(0) + 'W'}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ============ Holdings Content ============
  const totalProfit = holdings.reduce((sum, h) => {
    const q = holdingQuotes[h.code];
    return q ? sum + (q.price - h.buyPrice) * h.quantity : sum;
  }, 0);

  const HoldingsContent = (
    <div style={{ height: 'calc(85vh - 200px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['A', 'US', 'HK'] as MarketType[]).map(m => (
            <button key={m} onClick={() => setNewMarketType(m)} style={{ padding: '3px 8px', border: `1px solid ${newMarketType === m ? COLOR_UP : BORDER_COLOR}`, background: newMarketType === m ? '#001a00' : 'transparent', color: newMarketType === m ? COLOR_UP : '#555', fontFamily: 'monospace', fontSize: 10, cursor: 'pointer' }}>{m}</button>
          ))}
        </div>
        <Input placeholder="代码" value={newCode} onChange={e => setNewCode(e.target.value.trim())} style={{ width: 100 }} />
        <InputNumber placeholder="买入价" value={newBuyPrice} onChange={v => setNewBuyPrice(v)} min={0} step={0.01} style={{ width: 90 }} />
        <InputNumber placeholder="数量" value={newQuantity} onChange={v => setNewQuantity(v)} min={1} step={100} style={{ width: 80 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddHolding} style={{ background: '#003300', borderColor: COLOR_UP }}>ADD</Button>
      </div>
      {holdings.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#333', padding: 60, fontFamily: 'monospace' }}>[ NO POSITIONS - ADD STOCKS TO TRACK ]</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 70px 90px 70px 80px 90px 36px', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${BORDER_COLOR}`, fontSize: 10, color: '#335533', fontFamily: 'monospace' }}>
            <span>MKT</span><span>CODE</span><span>NAME</span><span>PRICE</span><span>CHG</span><span>P&L</span><span></span>
          </div>
          {holdings.map(h => {
            const q = holdingQuotes[h.code];
            const profit = q ? (q.price - h.buyPrice) * h.quantity : 0;
            return (
              <div key={h.code} style={{ display: 'grid', gridTemplateColumns: '50px 70px 90px 70px 80px 90px 36px', gap: 4, padding: '6px 10px', borderBottom: `1px solid #0a0a0a`, fontSize: 12, alignItems: 'center', fontFamily: 'monospace' }}>
                <span style={{ color: '#555', fontSize: 10 }}>[{h.marketType}]</span>
                <span style={{ color: '#00aa30' }}>{h.code}</span>
                <span style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                <span style={{ color: q ? getColor(q.changePercent) : COLOR_FLAT }}>{q ? q.price.toFixed(2) : '---'}</span>
                <span style={{ color: q ? getColor(q.changePercent) : COLOR_FLAT }}>{q ? `${q.changePercent > 0 ? '+' : ''}${q.changePercent.toFixed(2)}%` : '---'}</span>
                <span style={{ color: q ? getColor(profit) : COLOR_FLAT, fontWeight: 700, textShadow: q && profit !== 0 ? `0 0 8px ${getColor(profit)}44` : 'none' }}>{q ? `${profit > 0 ? '+' : ''}${profit.toFixed(2)}` : '---'}</span>
                <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => setHoldings(holdings.filter(x => x.code !== h.code))} style={{ color: COLOR_DOWN }} />
              </div>
            );
          })}
          <div style={{ marginTop: 16, textAlign: 'right', fontFamily: 'monospace', fontSize: 14, color: '#aaa', borderTop: `1px solid ${BORDER_COLOR}`, paddingTop: 12 }}>
            TOTAL P&L: <span style={{ fontWeight: 700, color: getColor(totalProfit), fontSize: 18, textShadow: `0 0 12px ${getColor(totalProfit)}66`, animation: 'glow-pulse 2s infinite' }}>{totalProfit > 0 ? '+' : ''}{totalProfit.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );

  // ============ AI Content ============
  const AiContent = (
    <div style={{ height: 'calc(85vh - 200px)', overflowY: 'auto' }}>
      {!deepseekKey ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <SettingOutlined style={{ fontSize: 36, color: '#333', marginBottom: 16 }} />
          <p style={{ color: '#555', marginBottom: 16, fontFamily: 'monospace' }}>[ ENTER DEEPSEEK API KEY TO ACTIVATE AI ANALYSIS ]</p>
          <Space>
            <Input.Password placeholder="sk-..." value={keyInput} onChange={e => setKeyInput(e.target.value)} style={{ width: 280 }} />
            <Button type="primary" onClick={saveKey} style={{ background: '#003300', borderColor: COLOR_UP }}>SAVE</Button>
          </Space>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <Button icon={<RocketOutlined />} onClick={handleAnalyze} loading={aiLoading} size="large"
              style={{ background: 'linear-gradient(135deg, #003300 0%, #001a00 100%)', border: `1px solid ${COLOR_UP}`, color: COLOR_UP, fontWeight: 700, fontFamily: 'monospace', boxShadow: GLOW_GREEN }}>
              {aiLoading ? 'ANALYZING...' : `ANALYZE ${marketLabel[market]} POTENTIAL`}
            </Button>
            <span style={{ color: '#333', fontSize: 11, fontFamily: 'monospace' }}>// based on top 20 gainers</span>
            <Button size="small" style={{ marginLeft: 'auto' }} onClick={() => { setDeepseekKey(''); localStorage.removeItem(DEEPSEEK_KEY_STORAGE); }}>RESET KEY</Button>
          </div>
          {aiLoading && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <p style={{ color: COLOR_UP, marginTop: 16, fontFamily: 'monospace', animation: 'glow-pulse 1.5s infinite' }}>[ NEURAL NETWORK PROCESSING... ]</p>
            </div>
          )}
          {aiResult && !aiLoading && (
            <div style={{ background: '#050505', borderRadius: 4, padding: 20, border: `1px solid ${BORDER_COLOR}`, whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#00cc33', fontSize: 13, fontFamily: '"Courier New", monospace', boxShadow: `inset 0 0 30px #00ff4108` }}>
              {aiResult}
            </div>
          )}
        </>
      )}
    </div>
  );

  // ============ Return ============
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="95vw"
      style={{ top: '3vh' }}
      styles={{
        body: { height: '90vh', padding: '16px 24px', background: BG_PRIMARY, overflow: 'hidden', position: 'relative' },
        header: { background: BG_PRIMARY, borderBottom: `1px solid ${BORDER_COLOR}` },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: COLOR_UP, fontSize: 16, fontFamily: '"Courier New", monospace', fontWeight: 700, textShadow: `0 0 10px ${COLOR_UP}`, animation: 'flicker 4s infinite' }}>
            {'>'} STOCK_TERMINAL v2.0
          </span>
          <span style={{ color: '#333', fontSize: 11, fontFamily: 'monospace' }}>// {new Date().toLocaleString()}</span>
        </div>
      }
      destroyOnClose={false}
      className="matrix-panel"
    >
      <style>{matrixStyles}</style>
      <MatrixRain />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Scanline effect */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${COLOR_UP}22, transparent)`, animation: 'scanline 8s linear infinite', pointerEvents: 'none', zIndex: 10 }} />
        {MarketSelector}
        {TabSelector}
        {activeTab === 'market' && MarketContent}
        {activeTab === 'holdings' && HoldingsContent}
        {activeTab === 'ai' && AiContent}
      </div>
    </Modal>
  );
}
