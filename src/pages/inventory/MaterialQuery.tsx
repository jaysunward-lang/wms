import { useEffect, useState } from 'react';
import { Table, Input, Button, Space, Form, Tag, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchMaterials } from '../../lib/api';
import type { MaterialItem } from '../../lib/api';
import type { ColumnsType } from 'antd/es/table';

const columns: ColumnsType<MaterialItem> = [
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

export default function MaterialQuery() {
  const [allData, setAllData] = useState<MaterialItem[]>([]);
  const [data, setData] = useState<MaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    const items = await fetchMaterials();
    setAllData(items);
    setData(items);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const onSearch = () => {
    const { keyword } = form.getFieldsValue();
    if (keyword) {
      const kw = keyword.toLowerCase();
      setData(allData.filter((i) =>
        i.material_name.toLowerCase().includes(kw) || i.location.toLowerCase().includes(kw)
      ));
    } else {
      setData(allData);
    }
  };

  const onReset = () => { form.resetFields(); setData(allData); };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <>
      <Form form={form} layout="inline" style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
        <Form.Item name="keyword">
          <Input placeholder="物料名称 / 库位" allowClear style={{ width: 220 }}
            onPressEnter={onSearch} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
      <Table columns={columns} dataSource={data} rowKey="id" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} size="middle" />
    </>
  );
}
