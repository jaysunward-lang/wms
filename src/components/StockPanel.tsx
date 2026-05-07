import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Modal, Input, InputNumber, Button, Space, message, Tabs, Spin } from 'antd';
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
  market: number;
  buyPrice: number;
  quantity: number;
}

// ============ Constants ============
const STORAGE_KEY = 'wms_stock_holdings';
const DEEPSEEK_KEY_STORAGE = 'wms_deepseek_key';
const COLOR_UP = '#00e676';
const COLOR_DOWN = '#ff1744';
const COLOR_FLAT = '#888';
const BG_PRIMARY = '#0a0a0f';
const BG_SECONDARY = '#1a1a2e';
const BORDER_COLOR = '#0f3460';

// ============ API Functions ============
async function fetchAllStocks(): Promise<StockItem[]> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&fltt=2&invt=2&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f2,f3,f4,f5,f6,f7,f12,f14,f15,f16,f17,f18`;
    const res = await fetch(url);
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

async function fetchSingleQuote(code: string): Promise<{ price: number; changePercent: number; name: string } | null> {
  const market = code.startsWith('6') ? 1 : 0;
  try {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${code}&fields=f43,f57,f58,f170`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.data) return null;
    return {
      price: json.data.f43 / 100,
      changePercent: json.data.f170 / 100,
      name: json.data.f58,
    };
  } catch {
    return null;
  }
}

async function analyzeWithDeepSeek(apiKey: string, topStocks: StockItem[]): Promise<string> {
  const stockInfo = topStocks.map(s => `${s.name}(${s.code}) 现价:${s.price} 涨幅:${s.changePercent}% 成交额:${(s.turnover / 100000000).toFixed(2)}亿`).join('\n');
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `你是一位资深A股分析师。以下是今日A股涨幅前20的股票数据：\n\n${stockInfo}\n\n请从中选出3-5只最具潜力的股票，对每只股票给出：\n1. 推荐理由（技术面+基本面）\n2. 该公司的发展历史（成立时间、主营业务、重大事件）\n3. 近期走势分析\n4. 风险提示\n\n请用中文详细回答，格式清晰。`
      }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '分析失败，请稍后重试';
}

// ============ Styles ============
const darkScrollbar = `
  .stock-panel-dark ::-webkit-scrollbar { width: 6px; }
  .stock-panel-dark ::-webkit-scrollbar-track { background: ${BG_PRIMARY}; }
  .stock-panel-dark ::-webkit-scrollbar-thumb { background: ${BORDER_COLOR}; border-radius: 3px; }
  .stock-panel-dark ::-webkit-scrollbar-thumb:hover { background: #1a5276; }
  .stock-panel-dark .ant-tabs-nav { margin-bottom: 0 !important; }
  .stock-panel-dark .ant-tabs-tab { color: #aaa !important; }
  .stock-panel-dark .ant-tabs-tab-active .ant-tabs-tab-btn { color: ${COLOR_UP} !important; }
  .stock-panel-dark .ant-tabs-ink-bar { background: ${COLOR_UP} !important; }
  .stock-panel-dark .ant-input { background: ${BG_SECONDARY} !important; border-color: ${BORDER_COLOR} !important; color: #fff !important; }
  .stock-panel-dark .ant-input-number { background: ${BG_SECONDARY} !important; border-color: ${BORDER_COLOR} !important; color: #fff !important; }
  .stock-panel-dark .ant-input-number-input { color: #fff !important; }
  .stock-panel-dark .ant-btn-default { border-color: ${BORDER_COLOR} !important; color: #ccc !important; background: ${BG_SECONDARY} !important; }
  .stock-panel-dark .ant-modal-close { color: #aaa !important; }
  @keyframes pulse-glow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
`;

// ============ Main Component ============
interface StockPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function StockPanel({ open, onClose }: StockPanelProps) {
  const [allStocks, setAllStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'changePercent' | 'turnover'>('changePercent');
  const [sortDesc, setSortDesc] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Holdings state
  const [holdings, setHoldings] = useState<StockHolding[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [holdingQuotes, setHoldingQuotes] = useState<Record<string, { price: number; changePercent: number }>>({});
  const [newCode, setNewCode] = useState('');
  const [newBuyPrice, setNewBuyPrice] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState<number | null>(null);

  // DeepSeek state
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem(DEEPSEEK_KEY_STORAGE) || '');
  const [keyInput, setKeyInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Persist holdings
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)); }, [holdings]);

  // Fetch all stocks
  const loadStocks = useCallback(async () => {
    setLoading(true);
    const data = await fetchAllStocks();
    if (data.length > 0) setAllStocks(data);
    setLoading(false);
  }, []);

  // Auto refresh
  useEffect(() => {
    if (open) {
      loadStocks();
      timerRef.current = setInterval(loadStocks, 15000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, loadStocks]);

  // Refresh holding quotes
  useEffect(() => {
    if (!open || holdings.length === 0) return;
    const refresh = async () => {
      const results: Record<string, { price: number; changePercent: number }> = {};
      await Promise.all(holdings.map(async (h) => {
        const q = await fetchSingleQuote(h.code);
        if (q) results[h.code] = { price: q.price, changePercent: q.changePercent };
      }));
      setHoldingQuotes(results);
    };
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [open, holdings]);

  // Filtered & sorted stocks
  const displayStocks = useMemo(() => {
    let list = [...allStocks];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(item => item.code.includes(s) || item.name.toLowerCase().includes(s));
    }
    list.sort((a, b) => sortDesc ? (b[sortBy] - a[sortBy]) : (a[sortBy] - b[sortBy]));
    return list;
  }, [allStocks, search, sortBy, sortDesc]);

  // Add holding
  const handleAddHolding = async () => {
    if (!newCode || !newBuyPrice || !newQuantity) { message.warning('请填写完整信息'); return; }
    if (holdings.find(h => h.code === newCode)) { message.warning('该股票已存在'); return; }
    const q = await fetchSingleQuote(newCode);
    if (!q) { message.error('无法获取该股票信息'); return; }
    setHoldings([...holdings, { code: newCode, name: q.name, market: newCode.startsWith('6') ? 1 : 0, buyPrice: newBuyPrice, quantity: newQuantity }]);
    setHoldingQuotes(prev => ({ ...prev, [newCode]: { price: q.price, changePercent: q.changePercent } }));
    setNewCode(''); setNewBuyPrice(null); setNewQuantity(null);
    message.success(`已添加 ${q.name}`);
  };

  // DeepSeek analyze
  const handleAnalyze = async () => {
    if (!deepseekKey) { message.warning('请先设置 DeepSeek API Key'); return; }
    setAiLoading(true);
    try {
      const top20 = [...allStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 20);
      const result = await analyzeWithDeepSeek(deepseekKey, top20);
      setAiResult(result);
    } catch {
      message.error('AI 分析失败，请检查 API Key');
    }
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

  // ============ Market Tab ============
  const MarketTab = (
    <div style={{ height: 'calc(90vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#666' }} />}
          placeholder="搜索代码或名称"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Button size="small" onClick={() => { setSortBy('changePercent'); setSortDesc(true); }}
          style={{ background: sortBy === 'changePercent' && sortDesc ? COLOR_UP : undefined, borderColor: sortBy === 'changePercent' && sortDesc ? COLOR_UP : undefined, color: sortBy === 'changePercent' && sortDesc ? '#000' : undefined }}>
          涨幅榜
        </Button>
        <Button size="small" onClick={() => { setSortBy('changePercent'); setSortDesc(false); }}
          style={{ background: sortBy === 'changePercent' && !sortDesc ? COLOR_DOWN : undefined, borderColor: sortBy === 'changePercent' && !sortDesc ? COLOR_DOWN : undefined, color: sortBy === 'changePercent' && !sortDesc ? '#fff' : undefined }}>
          跌幅榜
        </Button>
        <Button size="small" onClick={() => { setSortBy('turnover'); setSortDesc(true); }}
          style={{ background: sortBy === 'turnover' ? '#ffd600' : undefined, borderColor: sortBy === 'turnover' ? '#ffd600' : undefined, color: sortBy === 'turnover' ? '#000' : undefined }}>
          成交额
        </Button>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 12 }}>
          共 {allStocks.length} 只 {loading && <Spin size="small" style={{ marginLeft: 8 }} />}
        </span>
        <Button size="small" icon={<ReloadOutlined />} onClick={loadStocks} loading={loading}>刷新</Button>
      </div>
      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 90px 80px 80px 80px 100px', gap: 4, padding: '8px 12px', background: BG_SECONDARY, borderRadius: 4, fontSize: 12, color: '#888', fontWeight: 500 }}>
        <span>代码</span><span>名称</span><span>现价</span><span>涨跌幅</span><span>涨跌额</span><span>成交额</span>
      </div>
      {/* Virtual scroll list */}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: 4 }}>
        {displayStocks.map(stock => (
          <div key={stock.code} style={{ display: 'grid', gridTemplateColumns: '80px 90px 80px 80px 80px 100px', gap: 4, padding: '6px 12px', borderBottom: `1px solid ${BG_SECONDARY}`, fontSize: 13, alignItems: 'center' }}>
            <span style={{ color: '#ccc' }}>{stock.code}</span>
            <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</span>
            <span style={{ color: getColor(stock.changePercent), fontFamily: 'monospace' }}>{stock.price.toFixed(2)}</span>
            <span style={{ color: getColor(stock.changePercent), fontWeight: 600, fontFamily: 'monospace' }}>{stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
            <span style={{ color: getColor(stock.changeAmount), fontFamily: 'monospace' }}>{stock.changeAmount > 0 ? '+' : ''}{stock.changeAmount.toFixed(2)}</span>
            <span style={{ color: '#aaa', fontFamily: 'monospace' }}>{stock.turnover > 100000000 ? (stock.turnover / 100000000).toFixed(1) + '亿' : (stock.turnover / 10000).toFixed(0) + '万'}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ============ Holdings Tab ============
  const totalProfit = holdings.reduce((sum, h) => {
    const q = holdingQuotes[h.code];
    if (!q) return sum;
    return sum + (q.price - h.buyPrice) * h.quantity;
  }, 0);

  const HoldingsTab = (
    <div style={{ height: 'calc(90vh - 140px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input placeholder="股票代码" value={newCode} onChange={e => setNewCode(e.target.value.trim())} style={{ width: 120 }} />
        <InputNumber placeholder="买入价" value={newBuyPrice} onChange={v => setNewBuyPrice(v)} min={0} step={0.01} style={{ width: 100 }} />
        <InputNumber placeholder="数量" value={newQuantity} onChange={v => setNewQuantity(v)} min={1} step={100} style={{ width: 100 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddHolding}>添加</Button>
      </div>
      {holdings.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', padding: 40 }}>暂无持仓，添加股票开始跟踪</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '70px 80px 70px 80px 100px 40px', gap: 4, padding: '8px 12px', background: BG_SECONDARY, borderRadius: 4, fontSize: 12, color: '#888' }}>
            <span>代码</span><span>名称</span><span>现价</span><span>涨跌</span><span>盈亏</span><span></span>
          </div>
          {holdings.map(h => {
            const q = holdingQuotes[h.code];
            const profit = q ? (q.price - h.buyPrice) * h.quantity : 0;
            return (
              <div key={h.code} style={{ display: 'grid', gridTemplateColumns: '70px 80px 70px 80px 100px 40px', gap: 4, padding: '8px 12px', borderBottom: `1px solid ${BG_SECONDARY}`, fontSize: 13, alignItems: 'center' }}>
                <span style={{ color: '#ccc' }}>{h.code}</span>
                <span style={{ color: '#fff' }}>{h.name}</span>
                <span style={{ color: q ? getColor(q.changePercent) : COLOR_FLAT, fontFamily: 'monospace' }}>{q ? q.price.toFixed(2) : '-'}</span>
                <span style={{ color: q ? getColor(q.changePercent) : COLOR_FLAT, fontFamily: 'monospace' }}>{q ? `${q.changePercent > 0 ? '+' : ''}${q.changePercent.toFixed(2)}%` : '-'}</span>
                <span style={{ color: q ? getColor(profit) : COLOR_FLAT, fontWeight: 600, fontFamily: 'monospace' }}>{q ? `${profit > 0 ? '+' : ''}${profit.toFixed(2)}` : '-'}</span>
                <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => setHoldings(holdings.filter(x => x.code !== h.code))} style={{ color: COLOR_DOWN }} />
              </div>
            );
          })}
          <div style={{ marginTop: 12, textAlign: 'right', fontSize: 14, color: '#fff' }}>
            总盈亏：<span style={{ fontWeight: 700, color: getColor(totalProfit), fontSize: 16 }}>{totalProfit > 0 ? '+' : ''}{totalProfit.toFixed(2)} 元</span>
          </div>
        </>
      )}
    </div>
  );

  // ============ AI Tab ============
  const AiTab = (
    <div style={{ height: 'calc(90vh - 140px)', overflowY: 'auto' }}>
      {!deepseekKey ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <SettingOutlined style={{ fontSize: 40, color: '#666', marginBottom: 16 }} />
          <p style={{ color: '#aaa', marginBottom: 16 }}>首次使用需要设置 DeepSeek API Key</p>
          <Space>
            <Input.Password placeholder="输入 DeepSeek API Key" value={keyInput} onChange={e => setKeyInput(e.target.value)} style={{ width: 300 }} />
            <Button type="primary" onClick={saveKey}>保存</Button>
          </Space>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <Button type="primary" icon={<RocketOutlined />} onClick={handleAnalyze} loading={aiLoading} size="large"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', fontWeight: 600 }}>
              {aiLoading ? '正在分析...' : '分析潜力股'}
            </Button>
            <span style={{ color: '#666', fontSize: 12 }}>基于今日涨幅前20的股票进行AI分析</span>
            <Button size="small" style={{ marginLeft: 'auto' }} onClick={() => { setDeepseekKey(''); localStorage.removeItem(DEEPSEEK_KEY_STORAGE); }}>
              重置Key
            </Button>
          </div>
          {aiLoading && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <p style={{ color: '#aaa', marginTop: 16 }}>AI 正在分析市场数据，请稍候...</p>
            </div>
          )}
          {aiResult && !aiLoading && (
            <div style={{ background: BG_SECONDARY, borderRadius: 8, padding: 20, border: `1px solid ${BORDER_COLOR}`, whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#e0e0e0', fontSize: 14 }}>
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
      style={{ top: '5vh' }}
      styles={{ body: { height: '85vh', padding: '16px 24px', background: BG_PRIMARY, overflow: 'hidden' }, header: { background: BG_PRIMARY, borderBottom: `1px solid ${BORDER_COLOR}` } }}
      title={<span style={{ color: '#fff', fontSize: 18 }}>A 股实时行情</span>}
      destroyOnClose={false}
      className="stock-panel-dark"
    >
      <style>{darkScrollbar}</style>
      <Tabs
        defaultActiveKey="market"
        items={[
          { key: 'market', label: '全部行情', children: MarketTab },
          { key: 'holdings', label: '我的持仓', children: HoldingsTab },
          { key: 'ai', label: '潜力股', children: AiTab },
        ]}
      />
    </Modal>
  );
}
