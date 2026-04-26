import logo from '../assets/logo.png';
import { useState } from 'react';
import { Layout, Menu, Button, Dropdown, theme, Tooltip } from 'antd';
import {
  SearchOutlined,
  ExportOutlined,
  ImportOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  HomeOutlined,
  PictureOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: 'inventory',
    icon: <SearchOutlined />,
    label: '库存查询',
    children: [
      { key: '/inventory/material', label: '物料库存查询' },
      { key: '/inventory/surplus', label: '多余库存查询' },
    ],
  },
  {
    key: 'outbound',
    icon: <ExportOutlined />,
    label: '出库管理',
    children: [
      { key: '/outbound/material', label: '物料出库' },
      { key: '/outbound/surplus', label: '多余库存出库' },
    ],
  },
  {
    key: 'inbound',
    icon: <ImportOutlined />,
    label: '入库管理',
    children: [
      { key: '/inbound/material', label: '物料入库' },
      { key: '/inbound/surplus', label: '多余库存入库' },
    ],
  },
  {
    key: '/photos',
    icon: <PictureOutlined />,
    label: '现场照片',
  },
];

const pageTitles: Record<string, string> = {
  '/dashboard': '首页',
  '/inventory/material': '物料库存查询',
  '/inventory/surplus': '多余库存查询',
  '/outbound/material': '物料出库',
  '/outbound/surplus': '多余库存出库',
  '/inbound/material': '物料入库',
  '/inbound/surplus': '多余库存入库',
  '/photos': '现场照片',
};

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const currentUser = localStorage.getItem('wms_user') || '操作员';

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        localStorage.removeItem('wms_user');
        localStorage.removeItem('wms_mode');
        navigate('/entry');
      },
    },
  ];

  const selectedKeys = [location.pathname];
  const openKeys = location.pathname.split('/').slice(0, 2).join('/');
  const pageTitle = pageTitles[location.pathname] || 'WMS 仓库管理系统';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        style={{
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          background: '#fff',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <img
            src={logo}
            alt="Sunward Logistics"
            style={{
              height: collapsed ? 32 : 40,
              maxWidth: collapsed ? 32 : 180,
              objectFit: 'contain',
              transition: 'all 0.2s',
            }}
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={[openKeys.replace('/', '')]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <span style={{ fontSize: 16, fontWeight: 500 }}>{pageTitle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tooltip title="切换到手机端">
              <Button type="text" icon={<SwapOutlined />} onClick={() => {
                localStorage.setItem('wms_mode', 'mobile');
                navigate('/mobile');
              }} />
            </Tooltip>
            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
              <Button type="text" icon={<UserOutlined />}>
                {currentUser}
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 24 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: token.borderRadius,
              padding: 24,
              minHeight: 360,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
