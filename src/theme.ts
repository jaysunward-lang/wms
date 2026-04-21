import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f5f7fa',
    borderRadius: 6,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      headerBg: '#ffffff',
      bodyBg: '#f5f7fa',
    },
    Menu: {
      itemBg: '#ffffff',
      itemSelectedBg: '#e6f4ff',
      itemSelectedColor: '#1677ff',
    },
  },
};

export default theme;
