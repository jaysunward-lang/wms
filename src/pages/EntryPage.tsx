import { Form, Input, Button, Checkbox, App } from 'antd';
import { IdcardOutlined, DatabaseOutlined, MobileOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

export default function EntryPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = (values: { operatorName: string; mobileMode?: boolean }) => {
    const name = values.operatorName.trim();
    if (!name) { message.warning('请填写操作人姓名'); return; }

    const mode = values.mobileMode ? 'mobile' : 'desktop';
    localStorage.setItem('wms_user', name);
    localStorage.setItem('wms_mode', mode);

    navigate(mode === 'mobile' ? '/mobile' : '/dashboard');
  };

  return (
    <div className="auth-container">
      <div className="auth-brand">
        <DatabaseOutlined style={{ fontSize: 80, marginBottom: 24 }} />
        <h1>WMS 仓库管理系统</h1>
        <p>高效、智能的仓库管理解决方案</p>
      </div>
      <div className="auth-form-section">
        <div style={{ width: 360 }}>
          <h2 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
            欢迎使用
          </h2>
          <p style={{ color: '#999', marginBottom: 32 }}>
            请填写操作人信息后进入系统
          </p>
          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item
              name="operatorName"
              rules={[{ required: true, message: '请输入操作人姓名' }]}
            >
              <Input prefix={<IdcardOutlined />} placeholder="操作人姓名" />
            </Form.Item>
            <Form.Item name="mobileMode" valuePropName="checked">
              <Checkbox>
                <MobileOutlined style={{ marginRight: 4 }} />
                手机端模式
              </Checkbox>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                进 入
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
}
