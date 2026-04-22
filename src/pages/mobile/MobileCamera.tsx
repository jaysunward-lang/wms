import { useRef, useState, useEffect, useCallback } from 'react';
import { Button, App, Space, Typography, Spin } from 'antd';
import {
  CameraOutlined, ArrowLeftOutlined,
  ReloadOutlined, CloudUploadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { uploadPhoto, savePhotoRecord } from '../../lib/api';

const { Text } = Typography;

interface LocationInfo {
  latitude: number;
  longitude: number;
  address: string;
}

// 逆地理编码：经纬度 → 地址文字
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`,
    );
    const data = await res.json();
    // 拼接简短地址
    const a = data.address || {};
    const parts = [a.city || a.state, a.suburb || a.district || a.county, a.road].filter(Boolean);
    return parts.join(' ') || data.display_name?.slice(0, 40) || `${lat.toFixed(4)},${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
}

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const operator = localStorage.getItem('wms_user') || '操作员';

  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationError, setLocationError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // 实时时间
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' '));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // GPS 定位 + 逆地理编码
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError('浏览器不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const address = await reverseGeocode(latitude, longitude);
        setLocation({ latitude, longitude, address });
      },
      () => setLocationError('无法获取定位，请检查权限'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // 打开摄像头
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        if (!cancelled) setCameraError('无法打开摄像头，请检查权限');
      }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // 拍照 + 合成水印
  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(video, 0, 0, w, h);

    // 底部水印栏
    const barHeight = Math.max(80, h * 0.1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, h - barHeight, w, barHeight);

    const fontSize = Math.max(14, Math.round(barHeight * 0.22));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';

    const now = new Date();
    const dateText = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeText = now.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    const locText = location?.address || locationError || '定位获取中...';

    const pad = 16;
    const lineGap = fontSize * 1.4;
    const startY = h - barHeight / 2 - lineGap;
    ctx.fillText(`📅 ${dateText}  🕐 ${timeText}`, pad, startY);
    ctx.fillText(`📍 ${locText}`, pad, startY + lineGap);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
        }
      },
      'image/jpeg',
      0.92,
    );
  }, [location, locationError]);

  // 上传照片
  const upload = useCallback(async () => {
    if (!capturedBlob) return;
    setUploading(true);
    try {
      const filename = `WMS_${Date.now()}.jpg`;
      const photoUrl = await uploadPhoto(capturedBlob, filename);
      const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' ');
      await savePhotoRecord(operator, photoUrl, now, location?.address || '');
      message.success('照片已上传');
      // 重置回拍照模式
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCapturedBlob(null);
      setPreviewUrl('');
    } catch {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, operator, location, previewUrl, message]);

  // 重拍
  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl('');
  }, [previewUrl]);

  const locDisplay = location?.address || locationError || '定位获取中...';

  if (cameraError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text type="danger" style={{ marginBottom: 16 }}>{cameraError}</Text>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/mobile')}>返回</Button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部返回 */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: '#fff' }}
          onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); navigate('/mobile'); }}>
          返回
        </Button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {previewUrl ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <img src={previewUrl} alt="预览" style={{ width: '100%', flex: 1, objectFit: 'contain' }} />
          <Space style={{ padding: 20, justifyContent: 'center', background: '#111' }} size="middle">
            <Button icon={<ReloadOutlined />} onClick={retake} size="large">重拍</Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={upload}
              loading={uploading} size="large">
              上传
            </Button>
          </Space>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <video ref={videoRef} playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraReady ? 'block' : 'none' }} />
            {!cameraReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin tip="正在打开摄像头..." />
              </div>
            )}
            {cameraReady && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
              }}>
                <div>📅 {currentTime}</div>
                <div>📍 {locDisplay}</div>
              </div>
            )}
          </div>
          <div style={{ padding: 24, textAlign: 'center', background: '#111' }}>
            <Button type="primary" shape="circle" size="large"
              icon={<CameraOutlined />} disabled={!cameraReady} onClick={capture}
              style={{ width: 72, height: 72, fontSize: 28 }} />
          </div>
        </div>
      )}
    </div>
  );
}
