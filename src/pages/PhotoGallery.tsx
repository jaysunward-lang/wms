import { useEffect, useState, useCallback } from 'react';
import { Card, Col, Row, Image, Empty, Spin, Tag, Checkbox, Button, Space, App } from 'antd';
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { fetchPhotos, subscribePhotos, deletePhoto, deletePhotos } from '../lib/api';
import type { PhotoRecord } from '../lib/api';

export default function PhotoGallery() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const { message, modal } = App.useApp();

  useEffect(() => {
    fetchPhotos(100).then(setPhotos).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const channel = subscribePhotos((p) => setPhotos((prev) => [p, ...prev]));
    return () => { channel.unsubscribe(); };
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(photos.map((p) => p.id!)) : new Set());
  }, [photos]);

  // 删除选中
  const handleDeleteSelected = useCallback(() => {
    const selected = photos.filter((p) => selectedIds.has(p.id!));
    if (!selected.length) return;
    modal.confirm({
      title: `确认删除 ${selected.length} 张照片？`,
      content: '删除后无法恢复',
      okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        setDeleting(true);
        try {
          await deletePhotos(selected.map((p) => ({ id: p.id!, photo_url: p.photo_url })));
          setPhotos((prev) => prev.filter((p) => !selectedIds.has(p.id!)));
          setSelectedIds(new Set());
          message.success(`已删除 ${selected.length} 张照片`);
        } catch { message.error('删除失败'); }
        finally { setDeleting(false); }
      },
    });
  }, [photos, selectedIds, modal, message]);

  // 删除单张
  const handleDeleteOne = useCallback((photo: PhotoRecord) => {
    modal.confirm({
      title: '确认删除这张照片？', okText: '删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          await deletePhoto(photo.id!, photo.photo_url);
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          setSelectedIds((prev) => { const n = new Set(prev); n.delete(photo.id!); return n; });
          message.success('已删除');
        } catch { message.error('删除失败'); }
      },
    });
  }, [modal, message]);

  // 复制单张图片到剪贴板
  const [copying, setCopying] = useState(false);
  const handleCopy = useCallback(async () => {
    const selected = photos.filter((p) => selectedIds.has(p.id!));
    if (!selected.length) return;
    setCopying(true);
    try {
      if (selected.length === 1) {
        // 单张：复制到剪贴板
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = selected[0].photo_url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        message.success('已复制图片到剪贴板');
      } else {
        // 多张：逐个下载为单独文件
        for (const p of selected) {
          const res = await fetch(p.photo_url, { mode: 'cors' });
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `WMS_${p.operator}_${p.taken_at?.replace(/[: ]/g, '-') || p.id}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        }
        message.success(`已下载 ${selected.length} 张照片`);
      }
    } catch {
      message.error('操作失败，请重试');
    } finally { setCopying(false); }
  }, [photos, selectedIds, message]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (photos.length === 0) return <Empty description="暂无现场照片" />;

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === photos.length && photos.length > 0;

  return (
    <div>
      {/* 操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Checkbox checked={allSelected} indeterminate={selectedCount > 0 && !allSelected}
          onChange={(e) => selectAll(e.target.checked)}>
          全选
        </Checkbox>
        {selectedCount > 0 && (
          <Space>
            <Button danger icon={<DeleteOutlined />} onClick={handleDeleteSelected} loading={deleting}>
              删除选中 ({selectedCount})
            </Button>
            <Button icon={<CopyOutlined />} onClick={handleCopy} loading={copying}>
              {selectedCount === 1 ? '复制图片' : `下载图片 (${selectedCount})`}
            </Button>
          </Space>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {photos.map((p) => (
          <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
            <Card hoverable
              cover={
                <div style={{ position: 'relative' }}>
                  <Image src={p.photo_url} alt={p.taken_at}
                    style={{ height: 200, objectFit: 'cover' }}
                    preview={{ mask: '点击查看大图' }} />
                  {/* 选择框 */}
                  <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                    onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(p.id!)}
                      onChange={() => toggleSelect(p.id!)}
                      style={{ transform: 'scale(1.3)' }} />
                  </div>
                  {/* 删除按钮 */}
                  <Button type="text" danger size="small" icon={<DeleteOutlined />}
                    onClick={(e) => { e.stopPropagation(); handleDeleteOne(p); }}
                    style={{ position: 'absolute', top: 4, right: 4, zIndex: 1,
                      background: 'rgba(255,255,255,0.8)', borderRadius: '50%' }} />
                </div>
              }
              styles={{ body: { padding: 12 } }}>
              <div style={{ fontSize: 13 }}>
                <Tag color="blue">{p.operator}</Tag>
                <div style={{ marginTop: 6, color: '#666' }}>📅 {p.taken_at}</div>
                {p.location_text && (
                  <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>📍 {p.location_text}</div>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
