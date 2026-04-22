import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tag, theme, Spin, Image, Empty, Radio } from 'antd';
import {
  DatabaseOutlined,
  InboxOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import { fetchMaterials, fetchSurplus, fetchRecent, fetchPhotos, subscribePhotos } from '../lib/api';
import type { MaterialItem, SurplusItem, RecentRecord, PhotoRecord } from '../lib/api';
import type { ColumnsType } from 'antd/es/table';
import { useLocation } from 'react-router-dom';

const materialColumns: ColumnsType<MaterialItem> = [
  { title: '物料名称', dataIndex: 'material_name', width: '30%' },
  {
    title: '数量',
    dataIndex: 'quantity',
    width: '20%',
    align: 'center',
    render: (val: number, record: MaterialItem) => (
      <Tag color={val < 50 ? 'red' : val < 200 ? 'orange' : 'green'}>
        {val.toLocaleString()}{record.unit}
      </Tag>
    ),
  },
  { title: '库位', dataIndex: 'location', width: '20%', align: 'center' },
  { title: '更新时间', dataIndex: 'updated_at', width: '30%' },
];

const surplusColumns: ColumnsType<SurplusItem> = [
  { title: 'SKU', dataIndex: 'surplus_code', width: '25%' },
  {
    title: '数量',
    dataIndex: 'quantity',
    width: '25%',
    align: 'center',
    render: (val: number) => <Tag color="blue">{val.toLocaleString()}</Tag>,
  },
  { title: '库位', dataIndex: 'location', width: '20%', align: 'center' },
  { title: '更新时间', dataIndex: 'updated_at', width: '30%' },
];

const recentColumns: ColumnsType<RecentRecord> = [
  { title: '时间', dataIndex: 'time', width: '30%' },
  {
    title: '类型',
    dataIndex: 'type',
    width: '15%',
    align: 'center',
    render: (v: string) => (
      <Tag color={v === '入库' ? 'green' : 'orange'}>{v}</Tag>
    ),
  },
  { title: '名称', dataIndex: 'name', width: '30%' },
  { title: '数量', dataIndex: 'quantity', width: '25%', align: 'center' },
];

export default function Dashboard() {
  const { token } = theme.useToken();
  const location = useLocation();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [surplus, setSurplus] = useState<SurplusItem[]>([]);
  const [recent, setRecent] = useState<RecentRecord[]>([]);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentFilter, setRecentFilter] = useState<string>('all');

  // 每次进入首页都重新加载数据
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMaterials(), fetchSurplus(), fetchRecent()])
      .then(([m, s, r]) => { setMaterials(m); setSurplus(s); setRecent(r); })
      .finally(() => setLoading(false));
    fetchPhotos(6).then(setPhotos).catch(() => {});
  }, [location.key]);

  // Realtime 订阅新照片
  useEffect(() => {
    const channel = subscribePhotos((newPhoto) => {
      setPhotos((prev) => [newPhoto, ...prev].slice(0, 6));
    });
    return () => { channel.unsubscribe(); };
  }, []);

  const materialTotal = materials.reduce((s, i) => s + i.quantity, 0);
  const surplusTotal = surplus.reduce((s, i) => s + i.quantity, 0);
  const cardStyle = { borderRadius: token.borderRadius, height: '100%' };

  const filteredRecent = recentFilter === 'all' ? recent : recent.filter((r) => r.type === recentFilter);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="物料种类" value={materials.length} prefix={<DatabaseOutlined style={{ color: token.colorPrimary }} />} suffix="种" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="物料库存总量" value={materialTotal} prefix={<InboxOutlined style={{ color: '#52c41a' }} />} styles={{ content: { color: '#52c41a' } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="SKU 种类" value={surplus.length} prefix={<ExportOutlined style={{ color: '#faad14' }} />} suffix="种" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic title="SKU 库存总量" value={surplusTotal} prefix={<ImportOutlined style={{ color: '#ff4d4f' }} />} styles={{ content: { color: '#ff4d4f' } }} />
          </Card>
        </Col>
      </Row>
      <Card title="物料库存" style={{ marginTop: 24 }}>
        <Table columns={materialColumns} dataSource={materials} rowKey="id" pagination={false} size="middle" />
      </Card>
      <Card title="SKU 库存" style={{ marginTop: 24 }}>
        <Table columns={surplusColumns} dataSource={surplus} rowKey="id" pagination={false} size="middle" />
      </Card>
      <Card title="最近库存变动" style={{ marginTop: 24 }}
        extra={
          <Radio.Group value={recentFilter} onChange={(e) => setRecentFilter(e.target.value)} size="small">
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="入库">入库</Radio.Button>
            <Radio.Button value="出库">出库</Radio.Button>
          </Radio.Group>
        }>
        <Table columns={recentColumns} dataSource={filteredRecent} rowKey="id" pagination={false} size="middle" />
      </Card>
      <Card title="现场照片（最新）" style={{ marginTop: 24 }}>
        {photos.length === 0 ? (
          <Empty description="暂无照片" />
        ) : (
          <Row gutter={[12, 12]}>
            {photos.map((p) => (
              <Col xs={12} sm={8} lg={4} key={p.id}>
                <Image
                  src={p.photo_url}
                  alt={p.taken_at}
                  style={{ width: '100%', borderRadius: 6, objectFit: 'cover', aspectRatio: '4/3' }}
                  preview={{ mask: `${p.operator} · ${p.taken_at}` }}
                />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4, textAlign: 'center' }}>
                  {p.operator} · {p.location_text || p.taken_at}
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  );
}
