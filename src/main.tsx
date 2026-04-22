import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { HashRouter } from 'react-router-dom';
import theme from './theme';
import MyApp from './App';
import './index.css';

function normalizeGithubPagesPath() {
  const base = import.meta.env.BASE_URL;
  const basePath = base.replace(/\/$/, '');
  const { origin, pathname, search, hash } = window.location;

  if (hash) return;
  if (basePath && !pathname.startsWith(basePath)) return;

  const routePath = basePath ? pathname.slice(basePath.length) : pathname;
  if (!routePath || routePath === '/') return;

  const normalizedRoute = routePath.startsWith('/')
    ? routePath
    : `/${routePath}`;

  window.location.replace(`${origin}${base}#${normalizedRoute}${search}`);
}

normalizeGithubPagesPath();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={theme} locale={zhCN}>
      <App>
        <HashRouter>
          <MyApp />
        </HashRouter>
      </App>
    </ConfigProvider>
  </StrictMode>,
);
