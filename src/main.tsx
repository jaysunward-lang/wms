import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter } from 'react-router-dom';
import theme from './theme';
import MyApp from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={theme} locale={zhCN}>
      <App>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <MyApp />
        </BrowserRouter>
      </App>
    </ConfigProvider>
  </StrictMode>,
);
