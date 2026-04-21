import { Form, Input, Button, App } from 'antd';
import { UserOutlined, LockOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values: { username: string; password: string }) => {
    const user = await loginUser(values.username, values.password);
    if (user) {
      localStorage.setItem('wms_user', user.operator_name);
      message.success('登录成功');
      navigate('/');
    } else {
      message.error('用户名或密码错误');
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
            欢迎回来
          </h2>
          <p style={{ color: '#999', marginBottom: 32 }}>
            请登录您的账户
          </p>
          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                登 录
              </Button>
            </Form.Item>
          </Form>
          <div style={{ textAlign: 'center' }}>
            还没有账户？ <Link to="/register">立即注册</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
