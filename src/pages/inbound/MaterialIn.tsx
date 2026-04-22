import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, App, DatePicker, Col, Row, AutoComplete } from 'antd';
import dayjs from 'dayjs';
import { upsertMaterial, addRecentRecord, fetchMaterials } from '../../lib/api';

export default function MaterialIn() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [nameOptions, setNameOptions] = useState<{ value: string }[]>([]);

  useEffect(() => {
    fetchMaterials().then((items) => {
      const names = [...new Set(items.map((i) => i.material_name))];
      setNameOptions(names.map((n) => ({ value: n })));
    });
  }, []);

  const onFinish = async (values: {
    materialName: string;
    quantity: number;
    unit: string;
    location: string;
  }) => {
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm');
      await upsertMaterial(values.materialName, values.unit, values.quantity, values.location);
      await addRecentRecord(now, '入库', values.materialName, values.quantity);
      message.success('物料入库成功');
      form.resetFields();
      form.setFieldValue('date', dayjs());
    } catch {
      message.error('入库失败，请重试');
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      style={{ maxWidth: 480 }}
      initialValues={{ date: dayjs() }}
    >
      <Form.Item label="物料名称" name="materialName" rules={[{ required: true, message: '请输入物料名称' }]}>
        <AutoComplete options={nameOptions} placeholder="输入物料名称（支持联想）"
          filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())} />
      </Form.Item>
      <Form.Item label="数量 / 单位" required style={{ marginBottom: 0 }}>
        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
              <InputNumber min={1} placeholder="数量" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="unit" rules={[{ required: true, message: '请输入单位' }]}>
              <Input placeholder="单位（个、米、张）" />
            </Form.Item>
          </Col>
        </Row>
      </Form.Item>
      <Form.Item label="库位" name="location" rules={[{ required: true, message: '请输入库位' }]}>
        <Input placeholder="请输入库位（如：A-01-03）" />
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
