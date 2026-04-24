import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';

const MainLayout = lazy(() => import('./layouts/MainLayout'));
const EntryPage = lazy(() => import('./pages/EntryPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MaterialQuery = lazy(() => import('./pages/inventory/MaterialQuery'));
const SurplusQuery = lazy(() => import('./pages/inventory/SurplusQuery'));
const MaterialOut = lazy(() => import('./pages/outbound/MaterialOut'));
const SurplusOut = lazy(() => import('./pages/outbound/SurplusOut'));
const MaterialIn = lazy(() => import('./pages/inbound/MaterialIn'));
const SurplusIn = lazy(() => import('./pages/inbound/SurplusIn'));
const PhotoGallery = lazy(() => import('./pages/PhotoGallery'));
const MobileHome = lazy(() => import('./pages/mobile/MobileHome'));
const MobileCamera = lazy(() => import('./pages/mobile/MobileCamera'));
const MobileInbound = lazy(() => import('./pages/mobile/MobileInbound'));
const MobilePhotoGallery = lazy(() => import('./pages/mobile/MobilePhotoGallery'));

const Loading = () => <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

function RootRedirect() {
  const user = localStorage.getItem('wms_user');
  const mode = localStorage.getItem('wms_mode');
  if (!user || !mode) return <Navigate to="/entry" replace />;
  return <Navigate to={mode === 'mobile' ? '/mobile' : '/dashboard'} replace />;
}

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/entry" element={<EntryPage />} />
        <Route index element={<RootRedirect />} />
        <Route path="/" element={<MainLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory/material" element={<MaterialQuery />} />
          <Route path="inventory/surplus" element={<SurplusQuery />} />
          <Route path="outbound/material" element={<MaterialOut />} />
          <Route path="outbound/surplus" element={<SurplusOut />} />
          <Route path="inbound/material" element={<MaterialIn />} />
          <Route path="inbound/surplus" element={<SurplusIn />} />
          <Route path="photos" element={<PhotoGallery />} />
        </Route>
        <Route path="/mobile" element={<MobileHome />} />
        <Route path="/mobile/camera" element={<MobileCamera />} />
        <Route path="/mobile/inbound" element={<MobileInbound />} />
        <Route path="/mobile/photos" element={<MobilePhotoGallery />} />
      </Routes>
    </Suspense>
  );
}

export default App;
