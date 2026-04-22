import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, App, DatePicker, AutoComplete } from 'antd';
import dayjs from 'dayjs';
import { upsertSurplus, addRecentRecord, fetchSurplus } from '../../lib/api';

export default function SurplusIn() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [skuOptions, setSkuOptions] = useState<{ value: string }[]>([]);

  useEffect(() => {
    fetchSurplus().then((items) => {
      const codes = [...new Set(items.map((i) => i.surplus_code))];
      setSkuOptions(codes.map((c) => ({ value: c })));
    });
  }, []);

  const onFinish = async (values: {
    surplusCode: string;
    quantity: number;
    location: string;
  }) => {
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm');
      await upsertSurplus(values.surplusCode, values.quantity, values.location);
      await addRecentRecord(now, '入库', values.surplusCode, values.quantity);
      message.success('SKU 入库成功');
      form.resetFields();
      form.setFieldValue('date', dayjs());
    } catch {
      message.error('入库失败，请重试');
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 480 }} initialValues={{ date: dayjs() }}>
      <Form.Item label="SKU" name="surplusCode" rules={[{ required: true, message: '请输入 SKU' }]}>
        <AutoComplete options={skuOptions} placeholder="输入 SKU（支持联想）"
          filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())} />
      </Form.Item>
      <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入入库数量' }]}>
        <InputNumber min={1} placeholder="请输入数量" style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="库位" name="location" rules={[{ required: true, message: '请输入库位' }]}>
        <Input placeholder="请输入库位（如：D-01-01）" />
      </Form.Item>
      <Form.Item label="入库日期" name="date">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">提交入库</Button>
      </Form.Item>
    </Form>
  );
}
