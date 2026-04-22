import { Button, Typography } from 'antd';
import { CameraOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function MobileHome() {
  const navigate = useNavigate();
  const operator = localStorage.getItem('wms_user') || '操作员';

  const handleExit = () => {
    localStorage.removeItem('wms_user');
    localStorage.removeItem('wms_mode');
    navigate('/entry');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #f0f5ff 0%, #fff 100%)',
    }}>
      {/* 顶部栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', background: '#fff',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <Text strong style={{ fontSize: 16 }}>操作人：{operator}</Text>
        <Button type="text" danger icon={<LogoutOutlined />} onClick={handleExit}>
          退出
        </Button>
      </div>

      {/* 中间内容 */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 32,
      }}>
        <Title level={3} style={{ marginBottom: 48, color: '#333' }}>
          WMS 仓库管理
        </Title>
        <Button
          type="primary"
          shape="round"
          size="large"
          icon={<CameraOutlined />}
          onClick={() => navigate('/mobile/camera')}
          style={{
            width: 200, height: 200, fontSize: 20,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
          }}
        >
          水印相机
        </Button>
      </div>
    </div>
  );
}
