import { useEffect, useState, useRef } from 'react';
import { Form, Input, InputNumber, Button, App, DatePicker, Col, Row, AutoComplete } from 'antd';
import dayjs from 'dayjs';
import { upsertMaterial, addRecentRecord, fetchMaterials } from '../../lib/api';
import type { InputRef } from 'antd';

export default function MaterialIn() {
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [nameOptions, setNameOptions] = useState<{ value: string }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qtyRef = useRef<any>(null);
  const unitRef = useRef<InputRef>(null);
  const locRef = useRef<InputRef>(null);

  useEffect(() => {
    fetchMaterials().then((items) => {
      const names = [...new Set(items.map((i) => i.material_name))];
      setNameOptions(names.map((n) => ({ value: n })));
    });
  }, []);

  const onFinish = async (values: { materialName: string; quantity: number; unit: string; location: string; lowStockThreshold?: number }) => {
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm');
      await upsertMaterial(values.materialName, values.unit, values.quantity, values.location, values.lowStockThreshold ?? null);
      await addRecentRecord(now, '入库', values.materialName, values.quantity);

      // Check low stock after inbound
      if (values.lowStockThreshold != null) {
        const items = await fetchMaterials();
        const updated = items.find(
          (i) => i.material_name === values.materialName && i.location === values.location
        );
        if (updated && updated.quantity <= values.lowStockThreshold) {
          notification.warning({
            message: '低库存警告',
            description: `${values.materialName}（${values.location}）当前库存 ${updated.quantity} ${values.unit}，已低于或等于阈值 ${values.lowStockThreshold}`,
            placement: 'bottomRight',
            duration: 8,
          });
        }
      }

      message.success('物料入库成功');
      form.resetFields();
      form.setFieldValue('date', dayjs());
    } catch { message.error('入库失败，请重试'); }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 480 }} initialValues={{ date: dayjs() }}>
      <Form.Item label="物料名称" name="materialName" rules={[{ required: true, message: '请输入物料名称' }]}>
        <AutoComplete options={nameOptions} placeholder="输入物料名称（支持联想）"
          filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())}
          onSelect={() => setTimeout(() => qtyRef.current?.focus(), 50)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); qtyRef.current?.focus(); } }} />
      </Form.Item>
      <Form.Item label="数量 / 单位 / 低库存阈值（选填）" required style={{ marginBottom: 0 }}>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
              <InputNumber ref={qtyRef} min={1} placeholder="数量" style={{ width: '100%' }}
                onPressEnter={() => unitRef.current?.focus()} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="unit" rules={[{ required: true, message: '请输入单位' }]}>
              <Input ref={unitRef} placeholder="单位（个、米、张）"
                onPressEnter={() => locRef.current?.focus()} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="lowStockThreshold">
              <InputNumber min={0} placeholder="低库存阈值" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Form.Item>
      <Form.Item label="库位" name="location" rules={[{ required: true, message: '请输入库位' }]}>
        <Input ref={locRef} placeholder="请输入库位（如：A-01-03）"
          onPressEnter={() => form.submit()} />
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
