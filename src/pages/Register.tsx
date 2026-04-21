import { Form, Input, Button, App } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  IdcardOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../lib/api';

export default function Register() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values: {
    operatorName: string;
    username: string;
    password: string;
  }) => {
    const result = await registerUser(values.username, values.password, values.operatorName);
    if (result.success) {
      message.success('注册成功，请登录');
      navigate('/login');
    } else {
      message.error(result.message);
    }
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
            创建账户
          </h2>
          <p style={{ color: '#999', marginBottom: 32 }}>
            注册新的操作员账户
          </p>
          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item name="operatorName" rules={[{ required: true, message: '请输入操作员姓名' }]}>
              <Input prefix={<IdcardOutlined />} placeholder="操作员姓名" />
            </Form.Item>
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>注 册</Button>
            </Form.Item>
          </Form>
          <div style={{ textAlign: 'center' }}>
            已有账户？ <Link to="/login">返回登录</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
