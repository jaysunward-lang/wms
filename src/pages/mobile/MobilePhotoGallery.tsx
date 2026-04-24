import { useEffect, useState, useCallback } from 'react';
import { Button, Image, Empty, Spin, Tag, App } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { fetchPhotos, subscribePhotos, deletePhoto } from '../../lib/api';
import type { PhotoRecord } from '../../lib/api';

export default function MobilePhotoGallery() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchPhotos(200);
    setPhotos(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const channel = subscribePhotos((p) => setPhotos((prev) => [p, ...prev]));
    return () => { channel.unsubscribe(); };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    message.success('已刷新');
  }, [load, message]);

  const handleDelete = useCallback((photo: PhotoRecord) => {
    modal.confirm({
      title: '确认删除这张照片？',
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          await deletePhoto(photo.id!, photo.photo_url);
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          message.success('已删除');
        } catch { message.error('删除失败'); }
      },
    });
  }, [modal, message]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 顶部栏 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))',
        background: '#fff', borderBottom: '1px solid #f0f0f0',
      }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/mobile')}>
          返回
        </Button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>现场照片</span>
        <Button type="text" icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefresh} />
      </div>

      {/* 照片列表 */}
      {photos.length === 0 ? (
        <div style={{ padding: '80px 0' }}>
          <Empty description="暂无现场照片" />
        </div>
      ) : (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {photos.map((p) => (
            <div key={p.id} style={{
              background: '#fff', borderRadius: 8, overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
              <div style={{ position: 'relative' }}>
                <Image src={p.photo_url} alt={p.taken_at}
                  style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }}
                  preview={{ mask: '查看大图' }} />
                <Button type="text" danger size="small" icon={<DeleteOutlined />}
                  onClick={(e) => { e.stopPropagation(); handleDelete(p); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 1,
                    background: 'rgba(255,255,255,0.85)', borderRadius: '50%',
                  }} />
              </div>
              <div style={{ padding: '8px 12px', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color="blue" style={{ margin: 0 }}>{p.operator}</Tag>
                  <span style={{ color: '#666' }}>📅 {p.taken_at}</span>
                </div>
                {p.location_text && (
                  <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>📍 {p.location_text}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部安全区 */}
      <div style={{ height: 'max(12px, env(safe-area-inset-bottom))' }} />
    </div>
  );
}
