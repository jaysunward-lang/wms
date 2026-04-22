import { useRef, useState, useEffect, useCallback } from 'react';
import { Button, App, Space, Typography, Spin, Input } from 'antd';
import {
  CameraOutlined, ArrowLeftOutlined,
  ReloadOutlined, CloudUploadOutlined, FontSizeOutlined, CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { uploadPhoto, savePhotoRecord } from '../../lib/api';

const { Text } = Typography;

interface LocationInfo {
  latitude: number;
  longitude: number;
  address: string;
}

interface TextAnnotation {
  id: number;
  text: string;
  fontSize: number;
  color: string;
  x: number; // 百分比 0~100
  y: number;
}

const COLORS = ['#ffffff', '#000000', '#ff4d4f', '#fadb14', '#52c41a', '#1677ff'];
const SIZES = [{ label: '小', value: 20 }, { label: '中', value: 32 }, { label: '大', value: 48 }];

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh`,
    );
    const data = await res.json();
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
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { message } = App.useApp();
  const operator = localStorage.getItem('wms_user') || '操作员';

  // 基础状态
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationError, setLocationError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // 缩放
  const [zoomLevel, setZoomLevel] = useState(1);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  // 文字标注
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [editingText, setEditingText] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textSize, setTextSize] = useState(32);
  const [textColor, setTextColor] = useState('#ffffff');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // 全屏
  useEffect(() => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen().catch(() => {});
    return () => {
      const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen().catch(() => {});
    };
  }, []);

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

  // GPS
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

  // 双指缩放
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !cameraReady) return;

    const getDist = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchStartDist.current = getDist(e);
        pinchStartZoom.current = zoomLevel;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getDist(e);
        const scale = dist / pinchStartDist.current;
        const newZoom = Math.min(5, Math.max(1, pinchStartZoom.current * scale));
        setZoomLevel(newZoom);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, [cameraReady, zoomLevel]);

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

    // 如果有缩放，裁剪中心区域
    if (zoomLevel > 1) {
      const cropW = w / zoomLevel;
      const cropH = h / zoomLevel;
      const sx = (w - cropW) / 2;
      const sy = (h - cropH) / 2;
      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, w, h);
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

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
          setAnnotations([]);
          setZoomLevel(1);
        }
      },
      'image/jpeg',
      0.92,
    );
  }, [location, locationError, zoomLevel]);

  // 添加文字标注
  const addAnnotation = useCallback(() => {
    if (!textInput.trim()) return;
    setAnnotations((prev) => [...prev, {
      id: Date.now(), text: textInput.trim(),
      fontSize: textSize, color: textColor, x: 50, y: 50,
    }]);
    setTextInput('');
    setEditingText(false);
  }, [textInput, textSize, textColor]);

  // 拖动文字
  const onAnnotationTouchStart = useCallback((id: number, e: React.TouchEvent) => {
    e.stopPropagation();
    setDraggingId(id);
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ann = annotations.find((a) => a.id === id);
    if (ann) {
      dragOffset.current = {
        x: touch.clientX - (rect.width * ann.x / 100),
        y: touch.clientY - (rect.height * ann.y / 100),
      };
    }
  }, [annotations]);

  const onPreviewTouchMove = useCallback((e: React.TouchEvent) => {
    if (draggingId === null) return;
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((touch.clientX - dragOffset.current.x) / rect.width) * 100));
    const y = Math.min(95, Math.max(5, ((touch.clientY - dragOffset.current.y) / rect.height) * 100));
    setAnnotations((prev) => prev.map((a) => a.id === draggingId ? { ...a, x, y } : a));
  }, [draggingId]);

  const onPreviewTouchEnd = useCallback(() => { setDraggingId(null); }, []);

  // 上传（合成文字标注到图片）
  const upload = useCallback(async () => {
    if (!capturedBlob) return;
    setUploading(true);
    try {
      let finalBlob = capturedBlob;

      // 如果有文字标注，重新合成
      if (annotations.length > 0) {
        const img = new Image();
        const url = URL.createObjectURL(capturedBlob);
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = url; });
        URL.revokeObjectURL(url);

        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        // 绘制文字标注
        for (const ann of annotations) {
          const px = (ann.x / 100) * c.width;
          const py = (ann.y / 100) * c.height;
          const fs = Math.round(ann.fontSize * (c.width / 400)); // 按图片宽度缩放字号
          ctx.font = `bold ${fs}px sans-serif`;
          ctx.fillStyle = ann.color;
          ctx.strokeStyle = ann.color === '#000000' ? '#ffffff' : '#000000';
          ctx.lineWidth = Math.max(1, fs * 0.08);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeText(ann.text, px, py);
          ctx.fillText(ann.text, px, py);
        }

        finalBlob = await new Promise<Blob>((resolve) => {
          c.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
        });
      }

      const filename = `WMS_${Date.now()}.jpg`;
      const photoUrl = await uploadPhoto(finalBlob, filename);
      const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' ');
      await savePhotoRecord(operator, photoUrl, now, location?.address || '');
      message.success('照片已上传');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCapturedBlob(null);
      setPreviewUrl('');
      setAnnotations([]);
    } catch {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }, [capturedBlob, annotations, operator, location, previewUrl, message]);

  // 重拍
  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl('');
    setAnnotations([]);
    setEditingText(false);
  }, [previewUrl]);

  // 退出相机
  const goBack = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen().catch(() => {});
    navigate('/mobile');
  }, [navigate]);

  const locDisplay = location?.address || locationError || '定位获取中...';

  if (cameraError) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#000' }}>
        <Text type="danger" style={{ marginBottom: 16 }}>{cameraError}</Text>
        <Button icon={<ArrowLeftOutlined />} onClick={goBack}>返回</Button>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {previewUrl ? (
        /* ===== 预览 + 文字标注模式 ===== */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 图片 + 标注层 */}
          <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
            onTouchMove={onPreviewTouchMove} onTouchEnd={onPreviewTouchEnd}>
            <img src={previewUrl} alt="预览"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            {/* 文字标注 */}
            {annotations.map((ann) => (
              <div key={ann.id}
                onTouchStart={(e) => onAnnotationTouchStart(ann.id, e)}
                style={{
                  position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`,
                  transform: 'translate(-50%, -50%)',
                  color: ann.color, fontSize: ann.fontSize, fontWeight: 'bold',
                  textShadow: ann.color === '#000000'
                    ? '0 0 4px #fff, 0 0 4px #fff'
                    : '0 0 4px #000, 0 0 4px #000',
                  cursor: 'move', userSelect: 'none', whiteSpace: 'nowrap',
                  padding: '2px 6px', touchAction: 'none',
                }}>
                {ann.text}
              </div>
            ))}
          </div>

          {/* 文字编辑面板 */}
          {editingText && (
            <div style={{
              background: '#222', padding: '14px 16px',
              borderTop: '1px solid #444',
            }}>
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="输入文字"
                style={{ marginBottom: 10, background: '#333', borderColor: '#555', color: '#fff' }}
                autoFocus
              />
              {/* 字号选择 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ color: '#aaa', fontSize: 12 }}>字号</Text>
                {SIZES.map((s) => (
                  <Button key={s.value} size="small"
                    type={textSize === s.value ? 'primary' : 'default'}
                    onClick={() => setTextSize(s.value)}
                    style={{ minWidth: 40 }}>
                    {s.label}
                  </Button>
                ))}
              </div>
              {/* 颜色选择 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ color: '#aaa', fontSize: 12 }}>颜色</Text>
                {COLORS.map((c) => (
                  <div key={c} onClick={() => setTextColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c,
                      border: textColor === c ? '3px solid #1677ff' : '2px solid #666',
                      cursor: 'pointer',
                    }} />
                ))}
              </div>
              <Button type="primary" icon={<CheckOutlined />} block onClick={addAnnotation}
                disabled={!textInput.trim()}>
                完成
              </Button>
            </div>
          )}

          {/* 底部操作栏 */}
          <Space style={{
            padding: '14px 20px', justifyContent: 'center', background: '#111',
            width: '100%',
            paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
          }} size="middle">
            <Button icon={<ReloadOutlined />} onClick={retake} size="large">重拍</Button>
            <Button icon={<FontSizeOutlined />} onClick={() => setEditingText(!editingText)}
              size="large" type={editingText ? 'primary' : 'default'}>
              T
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={upload}
              loading={uploading} size="large">
              上传
            </Button>
          </Space>
        </div>
      ) : (
        /* ===== 拍照模式 ===== */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 顶部返回 */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
            padding: '8px 12px', background: 'rgba(0,0,0,0.4)',
            paddingTop: 'max(8px, env(safe-area-inset-top))',
            display: 'flex', alignItems: 'center',
          }}>
            <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: '#fff' }} onClick={goBack}>
              返回
            </Button>
            {zoomLevel > 1 && (
              <Text style={{ color: '#fff', marginLeft: 'auto', fontSize: 13 }}>
                {zoomLevel.toFixed(1)}x
              </Text>
            )}
          </div>

          {/* 相机画面 */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <video ref={videoRef} playsInline muted
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                display: cameraReady ? 'block' : 'none',
                transform: `scale(${zoomLevel})`, transformOrigin: 'center center',
              }} />
            {!cameraReady && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Spin tip="正在打开摄像头..." />
              </div>
            )}
            {cameraReady && (
              <div style={{
                position: 'absolute', bottom: 100, left: 0, right: 0,
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                padding: '10px 14px', fontSize: 13, lineHeight: 1.6, zIndex: 2,
              }}>
                <div>📅 {currentTime}</div>
                <div>📍 {locDisplay}</div>
              </div>
            )}
          </div>

          {/* 拍照按钮 - 固定在底部 */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
            padding: '16px 0', textAlign: 'center',
            background: 'rgba(0,0,0,0.6)',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          }}>
            <Button type="primary" shape="circle" size="large"
              icon={<CameraOutlined />} disabled={!cameraReady} onClick={capture}
              style={{ width: 72, height: 72, fontSize: 28 }} />
          </div>
        </div>
      )}
    </div>
  );
}
