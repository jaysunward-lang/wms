import { useEffect, useState } from 'react';
import { Card, Col, Row, Image, Empty, Spin, Tag } from 'antd';
import { fetchPhotos, subscribePhotos } from '../lib/api';
import type { PhotoRecord } from '../lib/api';

export default function PhotoGallery() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos(100).then(setPhotos).finally(() => setLoading(false));
  }, []);

  // Realtime 订阅
  useEffect(() => {
    const channel = subscribePhotos((newPhoto) => {
      setPhotos((prev) => [newPhoto, ...prev]);
    });
    return () => { channel.unsubscribe(); };
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  if (photos.length === 0) return <Empty description="暂无现场照片" />;

  return (
    <Row gutter={[16, 16]}>
      {photos.map((p) => (
        <Col xs={24} sm={12} md={8} lg={6} key={p.id}>
          <Card
            hoverable
            cover={
              <Image
                src={p.photo_url}
                alt={p.taken_at}
                style={{ height: 200, objectFit: 'cover' }}
                preview={{ mask: '点击查看大图' }}
              />
            }
            bodyStyle={{ padding: 12 }}
          >
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
  );
}
