import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Input, InputNumber, Button, Table, Space, message, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';

interface StockHolding {
  code: string;
  name: string;
  market: number; // 1=沪 0=深
  buyPrice: number;
  quantity: number;
}

interface StockQuote {
  code: string;
  name: string;
  price: number;
  changePercent: number;
}

const STORAGE_KEY = 'wms_stock_holdings';

function getMarket(code: string): number {
  // 6开头沪市，其他深市
  return code.startsWith('6') ? 1 : 0;
}

async function fetchQuote(market: number, code: string): Promise<StockQuote | null> {
  try {
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${code}&fields=f43,f57,f58,f170`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.data) return null;
    const d = json.data;
    return {
      code: d.f57,
      name: d.f58,
      price: d.f43 / 100, // 东方财富返回的是分
      changePercent: d.f170 / 100,
    };
  } catch {
    return null;
  }
}

interface StockPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function StockPanel({ open, onClose }: StockPanelProps) {
  const [holdings, setHoldings] = useState<StockHolding[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [newCode, setNewCode] = useState('');
  const [newBuyPrice, setNewBuyPrice] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }, [holdings]);

  // 获取行情
  const refreshQuotes = useCallback(async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    const results: Record<string, StockQuote> = {};
    await Promise.all(
      holdings.map(async (h) => {
        const q = await fetchQuote(h.market, h.code);
        if (q) results[h.code] = q;
      })
    );
    setQuotes(results);
    setLoading(false);
  }, [holdings]);

  // 打开时刷新 + 定时刷新
  useEffect(() => {
    if (open) {
      refreshQuotes();
      timerRef.current = setInterval(refreshQuotes, 10000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, refreshQuotes]);

  const handleAdd = async () => {
    if (!newCode || !newBuyPrice || !newQuantity) {
      message.warning('请填写完整信息');
      return;
    }
    if (holdings.find((h) => h.code === newCode)) {
      message.warning('该股票已存在');
      return;
    }
    const market = getMarket(newCode);
    const q = await fetchQuote(market, newCode);
    if (!q) {
      message.error('无法获取该股票信息，请检查代码');
      return;
    }
    const newHolding: StockHolding = {
      code: newCode,
      name: q.name,
      market,
      buyPrice: newBuyPrice,
      quantity: newQuantity,
    };
    setHoldings([...holdings, newHolding]);
    setQuotes((prev) => ({ ...prev, [newCode]: q }));
    setNewCode('');
    setNewBuyPrice(null);
    setNewQuantity(null);
    message.success(`已添加 ${q.name}`);
  };

  const handleDelete = (code: string) => {
    setHoldings(holdings.filter((h) => h.code !== code));
    setQuotes((prev) => {
      const copy = { ...prev };
      delete copy[code];
      return copy;
    });
  };

  const columns = [
    {
      title: '股票',
      dataIndex: 'code',
      key: 'code',
      render: (_: string, record: StockHolding) => (
        <span>{record.name || record.code}</span>
      ),
    },
    {
      title: '现价',
      key: 'price',
      render: (_: unknown, record: StockHolding) => {
        const q = quotes[record.code];
        return q ? q.price.toFixed(2) : '-';
      },
    },
    {
      title: '涨跌',
      key: 'change',
      render: (_: unknown, record: StockHolding) => {
        const q = quotes[record.code];
        if (!q) return '-';
        return <Tag color={q.changePercent >= 0 ? 'red' : 'green'}>{q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%</Tag>;
      },
    },

    {
      title: '盈亏',
      key: 'profit',
      render: (_: unknown, record: StockHolding) => {
        const q = quotes[record.code];
        if (!q) return '-';
        const profit = (q.price - record.buyPrice) * record.quantity;
        const color = profit >= 0 ? '#cf1322' : '#3f8600';
        return (
          <span style={{ color, fontWeight: 500 }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(2)}
          </span>
        );
      },
    },
    {
      title: '成本/数量',
      key: 'info',
      render: (_: unknown, record: StockHolding) => (
        <span style={{ fontSize: 12, color: '#888' }}>
          {record.buyPrice}×{record.quantity}
        </span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: unknown, record: StockHolding) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.code)}
        />
      ),
    },
  ];

  // 计算总盈亏
  const totalProfit = holdings.reduce((sum, h) => {
    const q = quotes[h.code];
    if (!q) return sum;
    return sum + (q.price - h.buyPrice) * h.quantity;
  }, 0);

  return (
    <Modal
      title="📈 我的持仓"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose={false}
    >
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="股票代码 如600519"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.trim())}
            style={{ width: 140 }}
          />
          <InputNumber
            placeholder="买入价"
            value={newBuyPrice}
            onChange={(v) => setNewBuyPrice(v)}
            min={0}
            step={0.01}
            style={{ width: 100 }}
          />
          <InputNumber
            placeholder="数量"
            value={newQuantity}
            onChange={(v) => setNewQuantity(v)}
            min={1}
            step={100}
            style={{ width: 100 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={refreshQuotes}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        dataSource={holdings}
        columns={columns}
        rowKey="code"
        size="small"
        pagination={false}
        loading={loading}
      />

      {holdings.length > 0 && (
        <div style={{ marginTop: 12, textAlign: 'right', fontSize: 14 }}>
          总盈亏：
          <span style={{ fontWeight: 600, color: totalProfit >= 0 ? '#cf1322' : '#3f8600' }}>
            {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} 元
          </span>
        </div>
      )}
    </Modal>
  );
}



