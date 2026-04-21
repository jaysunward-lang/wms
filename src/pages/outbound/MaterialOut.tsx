import { useEffect, useState } from 'react';
import { Form, InputNumber, Select, Button, App, DatePicker, Input, Col, Row, Spin } from 'antd';
import dayjs from 'dayjs';
import { fetchMaterials, updateMaterialQty, addRecentRecord } from '../../lib/api';
import type { MaterialItem } from '../../lib/api';

export default function MaterialOut() {
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedItem, setSelectedItem] = useState<MaterialItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials().then((data) => { setMaterials(data); setLoading(false); });
  }, []);

  const materialNames = [...new Set(materials.map((i) => i.material_name))];
  const materialOptions = materialNames.map((name) => ({ label: name, value: name }));

  const onMaterialChange = (name: string) => {
    const items = materials.filter((i) => i.material_name === name);
    setLocationOptions(
      items.map((i) => ({
        label: `${i.location}（库存: ${i.quantity}${i.unit}）`,
        value: i.location,
      })),
    );
    const unit = items[0]?.unit || '';
    setSelectedItem(null);
    form.setFieldsValue({ location: undefined, quantity: undefined, unit });
  };

  const onLocationChange = (loc: string) => {
    const name = form.getFieldValue('materialName');
    const item = materials.find(
      (i) => i.material_name === name && i.location === loc,
    );
    setSelectedItem(item || null);
    if (item) form.setFieldValue('unit', item.unit);
    form.setFieldValue('quantity', undefined);
  };

  const onFinish = (values: {
    materialName: string;
    location: string;
    quantity: number;
    unit: string;
  }) => {
    if (!selectedItem) return;

    modal.confirm({
      title: '确认出库',
      content: `确认将「${values.materialName}」从库位 ${values.location} 出库 ${values.quantity}${values.unit} 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const now = dayjs().format('YYYY-MM-DD HH:mm');
          await updateMaterialQty(selectedItem.id!, selectedItem.quantity - values.quantity);
          await addRecentRecord(now, '出库', values.materialName, values.quantity);
          message.success('物料出库成功');
          // 刷新数据
          const data = await fetchMaterials();
          setMaterials(data);
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
      <Form.Item label="物料名称" name="materialName" rules={[{ required: true, message: '请选择物料' }]}>
        <Select showSearch placeholder="请选择物料" options={materialOptions} onChange={onMaterialChange}
          filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())} />
      </Form.Item>
      <Form.Item label="库位" name="location" rules={[{ required: true, message: '请选择库位' }]}>
        <Select placeholder={locationOptions.length ? '请选择库位' : '请先选择物料'} options={locationOptions} onChange={onLocationChange} disabled={!locationOptions.length} />
      </Form.Item>
      {selectedItem && (
        <div style={{ marginTop: -16, marginBottom: 16, color: '#999', fontSize: 13 }}>
          该库位当前库存: {selectedItem.quantity.toLocaleString()}
        </div>
      )}
      <Form.Item label="数量 / 单位" required style={{ marginBottom: 0 }}>
        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="quantity" rules={[
              { required: true, message: '请输入出库数量' },
              { validator: (_, value) => {
                if (value && selectedItem && value > selectedItem.quantity) return Promise.reject(new Error(`库存不足，当前库存 ${selectedItem.quantity}`));
                return Promise.resolve();
              }},
            ]}>
              <InputNumber min={1} max={selectedItem?.quantity ?? undefined} placeholder="数量" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="unit" rules={[{ required: true, message: '请选择物料后自动填充' }]}>
              <Input placeholder="自动填充" disabled />
            </Form.Item>
          </Col>
        </Row>
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
