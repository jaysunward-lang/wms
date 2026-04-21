import { useEffect, useState } from 'react';
import { Table, Input, Button, Space, Form, Tag, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchSurplus } from '../../lib/api';
import type { SurplusItem } from '../../lib/api';
import type { ColumnsType } from 'antd/es/table';

const columns: ColumnsType<SurplusItem> = [
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

export default function SurplusQuery() {
  const [allData, setAllData] = useState<SurplusItem[]>([]);
  const [data, setData] = useState<SurplusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSurplus().then((items) => {
      setAllData(items); setData(items); setLoading(false);
    });
  }, []);

  const onSearch = () => {
    const { keyword } = form.getFieldsValue();
    if (keyword) {
      const kw = keyword.toLowerCase();
      setData(allData.filter((i) => i.surplus_code.toLowerCase().includes(kw)));
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
          <Input placeholder="SKU" allowClear style={{ width: 220 }} />
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
