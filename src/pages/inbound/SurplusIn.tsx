import { useEffect, useState, useRef } from 'react';
import { Form, Input, InputNumber, Button, App, DatePicker, AutoComplete, Tag, Space } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { upsertSurplus, addRecentRecord, fetchSurplus } from '../../lib/api';
import type { SurplusItem } from '../../lib/api';
import type { InputRef } from 'antd';

export default function SurplusIn() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [skuOptions, setSkuOptions] = useState<{ value: string }[]>([]);
  const [surplusList, setSurplusList] = useState<SurplusItem[]>([]);
  const [skuLocations, setSkuLocations] = useState<{ location: string; quantity: number }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qtyRef = useRef<any>(null);
  const locRef = useRef<InputRef>(null);

  useEffect(() => {
    fetchSurplus().then((items) => {
      setSurplusList(items);
      const codes = [...new Set(items.map((i) => i.surplus_code))];
      setSkuOptions(codes.map((c) => ({ value: c })));
    });
  }, []);

  const onSkuSelect = (code: string) => {
    const locs = surplusList.filter((i) => i.surplus_code === code);
    setSkuLocations(locs.map((i) => ({ location: i.location, quantity: i.quantity })));
    setTimeout(() => qtyRef.current?.focus(), 50);
  };

  const onFinish = async (values: { surplusCode: string; quantity: number; location: string }) => {
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm');
      await upsertSurplus(values.surplusCode, values.quantity, values.location);
      await addRecentRecord(now, '入库', values.surplusCode, values.quantity);
      message.success('SKU 入库成功');
      form.resetFields();
      form.setFieldValue('date', dayjs());
      setSkuLocations([]);
    } catch { message.error('入库失败，请重试'); }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 480 }} initialValues={{ date: dayjs() }}>
      <Form.Item label="SKU" name="surplusCode" rules={[{ required: true, message: '请输入 SKU' }]}>
        <AutoComplete options={skuOptions} placeholder="输入 SKU"
          filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())}
          onSelect={onSkuSelect}
          onChange={() => setSkuLocations([])}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); qtyRef.current?.focus(); } }} />
      </Form.Item>
      <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入入库数量' }]}>
        <InputNumber ref={qtyRef} min={1} placeholder="请输入数量" style={{ width: '100%' }}
          onPressEnter={() => locRef.current?.focus()} />
      </Form.Item>
      <Form.Item label={<Space>库位<Button type="link" size="small" icon={<EnvironmentOutlined />}
        onClick={() => {
          const code = form.getFieldValue('surplusCode');
          if (!code) { message.info('请先输入SKU'); return; }
          const locs = surplusList.filter((i) => i.surplus_code === code);
          setSkuLocations(locs.map((i) => ({ location: i.location, quantity: i.quantity })));
          if (locs.length === 0) message.info('该SKU是新的，暂无库位记录');
        }}>推荐库位</Button></Space>} name="location" rules={[{ required: true, message: '请输入库位' }]}>
        <Input ref={locRef} placeholder="请输入库位"
          onPressEnter={() => form.submit()} />
      </Form.Item>
      {skuLocations.length > 0 && (
        <div style={{ marginTop: -16, marginBottom: 16 }}>
          {skuLocations.map((l) => (
            <Tag key={l.location} color="blue" style={{ cursor: 'pointer', marginBottom: 4 }}
              onClick={() => form.setFieldValue('location', l.location)}>
              {l.location}（{l.quantity}件）
            </Tag>
          ))}
        </div>
      )}
      <Form.Item label="入库日期" name="date">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">提交入库</Button>
      </Form.Item>
    </Form>
  );
}
