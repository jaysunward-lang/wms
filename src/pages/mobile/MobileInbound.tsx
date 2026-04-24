import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, App, AutoComplete, Modal, Segmented, Tag } from 'antd';
import { ArrowLeftOutlined, EnvironmentOutlined } from '@ant-design/icons';
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
  const [nameOptions, setNameOptions] = useState<{ value: string }[]>([]);
  const [skuOptions, setSkuOptions] = useState<{ value: string }[]>([]);
  const [materials, setMaterials] = useState<{ material_name: string; quantity: number; unit: string; location: string }[]>([]);
  const [surplusList, setSurplusList] = useState<{ surplus_code: string; quantity: number; location: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [skuLocations, setSkuLocations] = useState<{ location: string; quantity: number }[]>([]);
  const [currentSku, setCurrentSku] = useState('');
  const [pickedLocation, setPickedLocation] = useState('');

  const loadData = () => {
    fetchMaterials().then((items) => {
      setMaterials(items);
      setNameOptions([...new Set(items.map((i) => i.material_name))].map((n) => ({ value: n })));
    });
    fetchSurplus().then((items) => {
      setSurplusList(items);
      setSkuOptions([...new Set(items.map((i) => i.surplus_code))].map((c) => ({ value: c })));
    });
  };

  useEffect(() => { loadData(); }, []);

  const onMaterialNameSelect = (name: string) => {
    const item = materials.find((i) => i.material_name === name);
    if (item) setSelectedUnit(item.unit);
  };

  const resetForm = () => {
    setFormKey((k) => k + 1);
    setSelectedUnit('');
    setSkuLocations([]);
    setCurrentSku('');
    setPickedLocation('');
    loadData();
  };

  const showSkuLocations = (code: string) => {
    if (!code) { message.info('请先输入SKU'); return; }
    const locs = surplusList.filter((i) => i.surplus_code === code);
    setSkuLocations(locs.map((i) => ({ location: i.location, quantity: i.quantity })));
    if (locs.length === 0) message.info('该SKU是新的，暂无库位记录');
  };

  const handleMaterialSubmit = async (values: { materialName: string; quantity: number; unit: string; location: string }) => {
    const existing = materials.find((i) => i.material_name === values.materialName && i.location === values.location);
    if (existing) {
      Modal.confirm({
        title: '库位已有库存',
        content: `库位 ${values.location} 已存在 ${existing.quantity}${existing.unit} 的「${values.materialName}」，是否继续入库？`,
        okText: '继续入库', cancelText: '取消',
        onOk: () => doMaterialInbound(values),
      });
    } else { await doMaterialInbound(values); }
  };

  const doMaterialInbound = async (values: { materialName: string; quantity: number; unit: string; location: string }) => {
    setSubmitting(true);
    try {
      await upsertMaterial(values.materialName, values.unit, values.quantity, values.location);
      await addRecentRecord(dayjs().format('YYYY-MM-DD HH:mm'), '入库', values.materialName, values.quantity);
      message.success('物料入库成功');
      resetForm();
    } catch { message.error('入库失败'); }
    finally { setSubmitting(false); }
  };

  const handleSkuSubmit = async (values: { surplusCode: string; quantity: number; location: string }) => {
    const existing = surplusList.find((i) => i.surplus_code === values.surplusCode && i.location === values.location);
    if (existing) {
      Modal.confirm({
        title: '库位已有库存',
        content: `库位 ${values.location} 已存在 ${existing.quantity} 件的「${values.surplusCode}」，是否继续入库？`,
        okText: '继续入库', cancelText: '取消',
        onOk: () => doSkuInbound(values),
      });
    } else { await doSkuInbound(values); }
  };

  const doSkuInbound = async (values: { surplusCode: string; quantity: number; location: string }) => {
    setSubmitting(true);
    try {
      await upsertSurplus(values.surplusCode, values.quantity, values.location);
      await addRecentRecord(dayjs().format('YYYY-MM-DD HH:mm'), '入库', values.surplusCode, values.quantity);
      message.success('SKU 入库成功');
      resetForm();
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
        <Segmented value={tab} onChange={(v) => setTab(v as string)}
          options={['物料入库', 'SKU入库']} block style={{ marginBottom: 20 }} />

        {tab === '物料入库' ? (
          <Form key={`m-${formKey}`} layout="vertical" onFinish={handleMaterialSubmit}
            initialValues={{ unit: selectedUnit }}>
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
          <Form key={`s-${formKey}-${pickedLocation}`} layout="vertical" onFinish={handleSkuSubmit}
            initialValues={{ location: pickedLocation }}>
            <Form.Item label="SKU" name="surplusCode" rules={[{ required: true, message: '请输入SKU' }]}>
              <AutoComplete options={skuOptions} placeholder="输入SKU"
                filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())}
                onSelect={(v) => { setCurrentSku(v); setSkuLocations([]); }}
                onChange={(v) => { setCurrentSku(v); setSkuLocations([]); }} />
            </Form.Item>
            <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
              <InputNumber min={1} placeholder="数量" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="库位" name="location" rules={[{ required: true, message: '请输入库位' }]}>
              <Input placeholder="库位" />
            </Form.Item>
            <Button icon={<EnvironmentOutlined />} block style={{ marginBottom: 12 }}
              onClick={() => showSkuLocations(currentSku)}>
              推荐库位
            </Button>
            {skuLocations.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {skuLocations.map((l) => (
                  <Tag key={l.location} color="blue"
                    style={{ cursor: 'pointer', marginBottom: 4, fontSize: 14, padding: '4px 8px' }}
                    onClick={() => setPickedLocation(l.location)}>
                    {l.location}（{l.quantity}件）
                  </Tag>
                ))}
              </div>
            )}
            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>提交入库</Button>
          </Form>
        )}
      </div>
    </div>
  );
}
