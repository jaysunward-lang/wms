import { useRef, useState, useEffect, useCallback } from 'react';
import { Button, App, Space, Typography, Spin, Input, Segmented } from 'antd';
import {
  CameraOutlined, ArrowLeftOutlined,
  ReloadOutlined, CloudUploadOutlined, FontSizeOutlined, CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { uploadPhoto, savePhotoRecord } from '../../lib/api';

const { Text } = Typography;

interface LocationInfo { latitude: number; longitude: number; address: string; }
interface TextAnnotation { id: number; text: string; fontSize: number; color: string; x: number; y: number; }

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
  } catch { return `${lat.toFixed(6)}, ${lon.toFixed(6)}`; }
}

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
  const [zoomLevel, setZoomLevel] = useState(1);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [editingText, setEditingText] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textSize, setTextSize] = useState(32);
  const [textColor, setTextColor] = useState('#ffffff');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [category, setCategory] = useState('其他');

  // 实时时间
  useEffect(() => {
    const tick = () => setCurrentTime(new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' '));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) { setLocationError('浏览器不支持定位'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const address = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, address });
      },
      () => setLocationError('无法获取定位'),
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
      } catch { if (!cancelled) setCameraError('无法打开摄像头，请检查权限'); }
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
      if (e.touches.length === 2) { e.preventDefault(); pinchStartDist.current = getDist(e); pinchStartZoom.current = zoomLevel; }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2) { e.preventDefault(); setZoomLevel(Math.min(5, Math.max(1, pinchStartZoom.current * (getDist(e) / pinchStartDist.current)))); }
    };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); };
  }, [cameraReady, zoomLevel]);

  // 确保 video 恢复播放（预览→拍照切换后重新绑定 stream）
  useEffect(() => {
    if (!previewUrl && cameraReady && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      if (!video.srcObject || video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      if (video.paused) video.play().catch(() => {});
    }
  }, [previewUrl, cameraReady]);

  // 拍照
  const capture = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth, h = video.videoHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (zoomLevel > 1) {
      const cw = w / zoomLevel, ch = h / zoomLevel;
      ctx.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, w, h);
    } else { ctx.drawImage(video, 0, 0, w, h); }
    const barH = Math.max(80, h * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, h - barH, w, barH);
    const fs = Math.max(14, Math.round(barH * 0.22));
    ctx.font = `${fs}px sans-serif`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    const now = new Date();
    const d = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
    const t = now.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
    const loc = location?.address || locationError || '定位获取中...';
    const gap = fs * 1.4, sy = h - barH / 2 - gap;
    ctx.fillText(`📅 ${d}  🕐 ${t}`, 16, sy);
    ctx.fillText(`📍 ${loc}`, 16, sy + gap);
    canvas.toBlob((blob) => {
      if (blob) { setCapturedBlob(blob); setPreviewUrl(URL.createObjectURL(blob)); setAnnotations([]); setZoomLevel(1); }
    }, 'image/jpeg', 0.92);
  }, [location, locationError, zoomLevel]);

  // 文字标注
  const addAnnotation = useCallback(() => {
    if (!textInput.trim()) return;
    setAnnotations((p) => [...p, { id: Date.now(), text: textInput.trim(), fontSize: textSize, color: textColor, x: 50, y: 50 }]);
    setTextInput(''); setEditingText(false);
  }, [textInput, textSize, textColor]);

  const onAnnTouchStart = useCallback((id: number, e: React.TouchEvent) => {
    e.stopPropagation(); setDraggingId(id);
    const touch = e.touches[0], rect = containerRef.current?.getBoundingClientRect();
    const ann = annotations.find((a) => a.id === id);
    if (rect && ann) dragOffset.current = { x: touch.clientX - rect.width * ann.x / 100, y: touch.clientY - rect.height * ann.y / 100 };
  }, [annotations]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (draggingId === null) return;
    const touch = e.touches[0], rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnnotations((p) => p.map((a) => a.id === draggingId ? {
      ...a,
      x: Math.min(95, Math.max(5, (touch.clientX - dragOffset.current.x) / rect.width * 100)),
      y: Math.min(95, Math.max(5, (touch.clientY - dragOffset.current.y) / rect.height * 100)),
    } : a));
  }, [draggingId]);

  // 上传
  const upload = useCallback(async () => {
    if (!capturedBlob) return;
    setUploading(true);
    try {
      let finalBlob = capturedBlob;
      if (annotations.length > 0) {
        const img = new Image();
        const u = URL.createObjectURL(capturedBlob);
        await new Promise<void>((r) => { img.onload = () => r(); img.src = u; });
        URL.revokeObjectURL(u);
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
        for (const ann of annotations) {
          const px = ann.x / 100 * c.width, py = ann.y / 100 * c.height;
          const fs = Math.round(ann.fontSize * (c.width / 400));
          ctx.font = `bold ${fs}px sans-serif`; ctx.fillStyle = ann.color;
          ctx.strokeStyle = ann.color === '#000000' ? '#fff' : '#000'; ctx.lineWidth = Math.max(1, fs * 0.08);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.strokeText(ann.text, px, py); ctx.fillText(ann.text, px, py);
        }
        finalBlob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92));
      }
      const filename = `WMS_${Date.now()}.jpg`;
      const photoUrl = await uploadPhoto(finalBlob, filename);
      const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace('T', ' ');
      await savePhotoRecord(operator, photoUrl, now, location?.address || '', category);
      message.success('照片已上传');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCapturedBlob(null); setPreviewUrl(''); setAnnotations([]);
    } catch { message.error('上传失败，请重试'); }
    finally { setUploading(false); }
  }, [capturedBlob, annotations, operator, location, previewUrl, message, category]);

  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null); setPreviewUrl(''); setAnnotations([]); setEditingText(false);
  }, [previewUrl]);

  const goBack = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate('/mobile');
  }, [navigate]);

  const locDisplay = location?.address || locationError || '定位获取中...';

  if (cameraError) return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Text type="danger" style={{ marginBottom: 16 }}>{cameraError}</Text>
      <Button icon={<ArrowLeftOutlined />} onClick={goBack}>返回</Button>
    </div>
  );

  // 预览模式
  if (previewUrl) return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* 图片+标注 */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onTouchMove={onTouchMove} onTouchEnd={() => setDraggingId(null)}>
        <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        {annotations.map((a) => (
          <div key={a.id} onTouchStart={(e) => onAnnTouchStart(a.id, e)} style={{
            position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%,-50%)',
            color: a.color, fontSize: a.fontSize, fontWeight: 'bold', whiteSpace: 'nowrap',
            textShadow: a.color === '#000000' ? '0 0 4px #fff,0 0 4px #fff' : '0 0 4px #000,0 0 4px #000',
            userSelect: 'none', touchAction: 'none', padding: '2px 6px',
          }}>{a.text}</div>
        ))}
      </div>
      {/* 文字编辑面板 */}
      {editingText && (
        <div style={{ background: '#222', padding: '12px 16px', borderTop: '1px solid #444' }}>
          <Input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="输入文字"
            style={{ marginBottom: 8, background: '#333', borderColor: '#555', color: '#fff' }} autoFocus />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ color: '#aaa', fontSize: 12 }}>字号</Text>
            {SIZES.map((s) => (
              <Button key={s.value} size="small" type={textSize === s.value ? 'primary' : 'default'}
                onClick={() => setTextSize(s.value)} style={{ minWidth: 40 }}>{s.label}</Button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={{ color: '#aaa', fontSize: 12 }}>颜色</Text>
            {COLORS.map((c) => (
              <div key={c} onClick={() => setTextColor(c)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c,
                border: textColor === c ? '3px solid #1677ff' : '2px solid #666', cursor: 'pointer',
              }} />
            ))}
          </div>
          <Button type="primary" icon={<CheckOutlined />} block onClick={addAnnotation} disabled={!textInput.trim()}>完成</Button>
        </div>
      )}
      {/* 分类选择 */}
      <div style={{ padding: '8px 20px', background: '#111', display: 'flex', justifyContent: 'center' }}>
        <Segmented value={category} onChange={(v) => setCategory(v as string)}
          options={['入库', '出库', '上架', '其他']} />
      </div>
      {/* 底部操作栏 */}
      <Space style={{ padding: '12px 20px', justifyContent: 'center', background: '#111', width: '100%',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }} size="middle">
        <Button icon={<ReloadOutlined />} onClick={retake} size="large">重拍</Button>
        <Button icon={<FontSizeOutlined />} onClick={() => setEditingText(!editingText)}
          size="large" type={editingText ? 'primary' : 'default'}>T</Button>
        <Button type="primary" icon={<CloudUploadOutlined />} onClick={upload} loading={uploading} size="large">上传</Button>
      </Space>
    </div>
  );

  // 拍照模式 - 全 fixed 布局
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* video 铺满全屏 */}
      <video ref={videoRef} playsInline muted style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        display: cameraReady ? 'block' : 'none',
        transform: `scale(${zoomLevel})`, transformOrigin: 'center',
      }} />
      {!cameraReady && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin tip="正在打开摄像头..." />
        </div>
      )}
      {/* 顶部返回 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '8px 12px', paddingTop: 'max(8px, env(safe-area-inset-top))',
        background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: '#fff' }} onClick={goBack}>返回</Button>
        {zoomLevel > 1 && <Text style={{ color: '#fff', marginLeft: 'auto', fontSize: 13 }}>{zoomLevel.toFixed(1)}x</Text>}
      </div>
      {/* 水印信息 */}
      {cameraReady && (
        <div style={{ position: 'absolute', bottom: 110, left: 0, right: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '10px 14px', fontSize: 13, lineHeight: 1.6 }}>
          <div>📅 {currentTime}</div>
          <div>📍 {locDisplay}</div>
        </div>
      )}
      {/* 拍照按钮 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        padding: '20px 0', textAlign: 'center', background: 'rgba(0,0,0,0.4)',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <Button type="primary" shape="circle" size="large" icon={<CameraOutlined />}
          disabled={!cameraReady} onClick={capture} style={{ width: 72, height: 72, fontSize: 28 }} />
      </div>
    </div>
  );
}
