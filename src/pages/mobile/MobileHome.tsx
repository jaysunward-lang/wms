import type React from 'react';
import { Button, Typography, Tooltip } from 'antd';
import { CameraOutlined, LogoutOutlined, InboxOutlined, PictureOutlined, SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const gridItemStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  gap: 8, padding: '12px 0', cursor: 'pointer', borderRadius: 12,
  transition: 'background 0.2s',
};
const iconCircleStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const labelStyle: React.CSSProperties = { fontSize: 13, color: '#333' };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Tooltip title="切换到网页端">
            <Button type="text" icon={<SwapOutlined />} onClick={() => {
              localStorage.setItem('wms_mode', 'desktop');
              navigate('/dashboard');
            }} />
          </Tooltip>
          <Button type="text" danger icon={<LogoutOutlined />} onClick={handleExit}>
            退出
          </Button>
        </div>
      </div>

      {/* 九宫格内容 */}
      <div style={{ flex: 1, padding: '24px 16px' }}>
        <Title level={4} style={{ textAlign: 'center', marginBottom: 24, color: '#333' }}>
          WMS 仓库管理
        </Title>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
          maxWidth: 400, margin: '0 auto',
        }}>
          {/* 水印相机 */}
          <div onClick={() => navigate('/mobile/camera')} style={gridItemStyle}>
            <div style={{ ...iconCircleStyle, background: '#1677ff' }}>
              <CameraOutlined style={{ fontSize: 28, color: '#fff' }} />
            </div>
            <span style={labelStyle}>水印相机</span>
          </div>
          {/* 入库 */}
          <div onClick={() => navigate('/mobile/inbound')} style={gridItemStyle}>
            <div style={{ ...iconCircleStyle, background: '#52c41a' }}>
              <InboxOutlined style={{ fontSize: 28, color: '#fff' }} />
            </div>
            <span style={labelStyle}>入库</span>
          </div>
          {/* 现场照片 */}
          <div onClick={() => navigate('/mobile/photos')} style={gridItemStyle}>
            <div style={{ ...iconCircleStyle, background: '#722ed1' }}>
              <PictureOutlined style={{ fontSize: 28, color: '#fff' }} />
            </div>
            <span style={labelStyle}>现场照片</span>
          </div>
          {/* 占位格 */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`empty-${i}`} style={gridItemStyle}>
              <div style={{ ...iconCircleStyle, background: '#f0f0f0' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
