import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, App, AutoComplete, Modal, Segmented } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  fetchMaterials, fetchSurplus, upsertMaterial, upsertSurplus, addRecentRecord,
} from '../../lib/api';

export default function MobileInbound() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const operator = localStorage.getItem('wms_user') || '操作员';
  const [tab, setTab] = useState<string>('物料入库');
  const [materialForm] = Form.useForm();
  const [skuForm] = Form.useForm();
  const [nameOptions, setNameOptions] = useState<{ value: string }[]>([]);
  const [skuOptions, setSkuOptions] = useState<{ value: string }[]>([]);
  const [materials, setMaterials] = useState<{ material_name: string; quantity: number; unit: string; location: string }[]>([]);
  const [surplusList, setSurplusList] = useState<{ surplus_code: string; quantity: number; location: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const loadData = () => {
    fetchMaterials().then((items) => {
      setMaterials(items);
      const names = [...new Set(items.map((i) => i.material_name))];
      setNameOptions(names.map((n) => ({ value: n })));
    });
    fetchSurplus().then((items) => {
      setSurplusList(items);
      const codes = [...new Set(items.map((i) => i.surplus_code))];
      setSkuOptions(codes.map((c) => ({ value: c })));
    });
  };

  useEffect(() => { loadData(); }, []);

  const onMaterialNameSelect = (name: string) => {
    const item = materials.find((i) => i.material_name === name);
    if (item) {
      materialForm.setFieldValue('unit', item.unit);
    }
  };

  const handleMaterialSubmit = async (values: { materialName: string; quantity: number; unit: string; location: string }) => {
    const existing = materials.find(
      (i) => i.material_name === values.materialName && i.location === values.location
    );
    if (existing) {
      Modal.confirm({
        title: '库位已有库存',
        content: `库位 ${values.location} 已存在 ${existing.quantity}${existing.unit} 的「${values.materialName}」，是否继续入库？`,
        okText: '继续入库',
        cancelText: '取消',
        onOk: () => doMaterialInbound(values),
      });
    } else {
      await doMaterialInbound(values);
    }
  };

  const doMaterialInbound = async (values: { materialName: string; quantity: number; unit: string; location: string }) => {
    setSubmitting(true);
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm');
      await upsertMaterial(values.materialName, values.unit, values.quantity, values.location);
      await addRecentRecord(now, '入库', values.materialName, values.quantity);
      message.success('物料入库成功');
      setFormKey((k) => k + 1);
      loadData();
    } catch { message.error('入库失败'); }
    finally { setSubmitting(false); }
  };

  const handleSkuSubmit = async (values: { surplusCode: string; quantity: number; location: string }) => {
    const existing = surplusList.find(
      (i) => i.surplus_code === values.surplusCode && i.location === values.location
    );
    if (existing) {
      Modal.confirm({
        title: '库位已有库存',
        content: `库位 ${values.location} 已存在 ${existing.quantity} 件的「${values.surplusCode}」，是否继续入库？`,
        okText: '继续入库',
        cancelText: '取消',
        onOk: () => doSkuInbound(values),
      });
    } else {
      await doSkuInbound(values);
    }
  };

  const doSkuInbound = async (values: { surplusCode: string; quantity: number; location: string }) => {
    setSubmitting(true);
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm');
      await upsertSurplus(values.surplusCode, values.quantity, values.location);
      await addRecentRecord(now, '入库', values.surplusCode, values.quantity);
      message.success('SKU 入库成功');
      setFormKey((k) => k + 1);
      loadData();
    } catch { message.error('入库失败'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 16px',
        background: '#fff', borderBottom: '1px solid #f0f0f0',
      }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/mobile')} />
        <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 8 }}>入库 - {operator}</span>
      </div>

      <div style={{ padding: 16 }}>
        <Segmented
          value={tab} onChange={(v) => setTab(v as string)}
          options={['物料入库', 'SKU入库']}
          block style={{ marginBottom: 20 }}
        />

        {tab === '物料入库' ? (
          <Form key={`material-${formKey}`} form={materialForm} layout="vertical" onFinish={handleMaterialSubmit}>
            <Form.Item label="物料名称" name="materialName" rules={[{ required: true, message: '请输入物料名称' }]}>
              <AutoComplete options={nameOptions} placeholder="输入物料名称"
                filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())}
                onSelect={onMaterialNameSelect} />
            </Form.Item>
            <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
              <InputNumber min={1} placeholder="数量" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请输入单位' }]}>
              <Input placeholder="单位" />
            </Form.Item>
            <Form.Item label="库位" name="location" rules={[{ required: true, message: '请输入库位' }]}>
              <Input placeholder="库位" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>提交入库</Button>
          </Form>
        ) : (
          <Form key={`sku-${formKey}`} form={skuForm} layout="vertical" onFinish={handleSkuSubmit}>
            <Form.Item label="SKU" name="surplusCode" rules={[{ required: true, message: '请输入SKU' }]}>
              <AutoComplete options={skuOptions} placeholder="输入SKU"
                filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())} />
            </Form.Item>
            <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
              <InputNumber min={1} placeholder="数量" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="库位" name="location" rules={[{ required: true, message: '请输入库位' }]}>
              <Input placeholder="库位" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>提交入库</Button>
          </Form>
        )}
      </div>
    </div>
  );
}
