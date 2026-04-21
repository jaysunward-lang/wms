import { useEffect, useState } from 'react';
import { Form, InputNumber, Select, Button, App, DatePicker, Spin } from 'antd';
import dayjs from 'dayjs';
import { fetchSurplus, updateSurplusQty, addRecentRecord } from '../../lib/api';
import type { SurplusItem } from '../../lib/api';

export default function SurplusOut() {
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const [surplus, setSurplus] = useState<SurplusItem[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedItem, setSelectedItem] = useState<SurplusItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSurplus().then((data) => { setSurplus(data); setLoading(false); });
  }, []);

  const skuCodes = [...new Set(surplus.map((i) => i.surplus_code))];
  const skuOptions = skuCodes.map((code) => ({ label: code, value: code }));

  const onSkuChange = (code: string) => {
    const items = surplus.filter((i) => i.surplus_code === code);
    setLocationOptions(
      items.map((i) => ({ label: `${i.location}（库存: ${i.quantity}）`, value: i.location })),
    );
    setSelectedItem(null);
    form.setFieldsValue({ location: undefined, quantity: undefined });
  };

  const onLocationChange = (loc: string) => {
    const code = form.getFieldValue('surplusCode');
    const item = surplus.find((i) => i.surplus_code === code && i.location === loc);
    setSelectedItem(item || null);
    form.setFieldValue('quantity', undefined);
  };

  const onFinish = (values: { surplusCode: string; location: string; quantity: number }) => {
    if (!selectedItem) return;

    modal.confirm({
      title: '确认出库',
      content: `确认将 SKU「${values.surplusCode}」从库位 ${values.location} 出库 ${values.quantity} 件吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const now = dayjs().format('YYYY-MM-DD HH:mm');
          await updateSurplusQty(selectedItem.id!, selectedItem.quantity - values.quantity);
          await addRecentRecord(now, '出库', values.surplusCode, values.quantity);
          message.success('SKU 出库成功');
          const data = await fetchSurplus();
          setSurplus(data);
          setSelectedItem(null);
          setLocationOptions([]);
          form.resetFields();
          form.setFieldValue('date', dayjs());
        } catch {
          message.error('出库失败，请重试');
        }
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 480 }} initialValues={{ date: dayjs() }}>
      <Form.Item label="SKU" name="surplusCode" rules={[{ required: true, message: '请选择 SKU' }]}>
        <Select showSearch placeholder="请选择 SKU" options={skuOptions} onChange={onSkuChange}
          filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())} />
      </Form.Item>
      <Form.Item label="库位" name="location" rules={[{ required: true, message: '请选择库位' }]}>
        <Select placeholder={locationOptions.length ? '请选择库位' : '请先选择 SKU'} options={locationOptions} onChange={onLocationChange} disabled={!locationOptions.length} />
      </Form.Item>
      {selectedItem && (
        <div style={{ marginTop: -16, marginBottom: 16, color: '#999', fontSize: 13 }}>
          该库位当前库存: {selectedItem.quantity.toLocaleString()}
        </div>
      )}
      <Form.Item label="出库数量" name="quantity" rules={[
        { required: true, message: '请输入出库数量' },
        { validator: (_, value) => {
          if (value && selectedItem && value > selectedItem.quantity) return Promise.reject(new Error(`库存不足，当前库存 ${selectedItem.quantity}`));
          return Promise.resolve();
        }},
      ]}>
        <InputNumber min={1} max={selectedItem?.quantity ?? undefined} placeholder="请输入数量" style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="出库日期" name="date">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">提交出库</Button>
      </Form.Item>
    </Form>
  );
}
