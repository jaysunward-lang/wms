import { supabase } from './supabase';

/* ========== 类型定义 ========== */
export interface MaterialItem {
  id?: number;
  material_name: string;
  unit: string;
  quantity: number;
  location: string;
  updated_at: string;
}

export interface SurplusItem {
  id?: number;
  surplus_code: string;
  quantity: number;
  location: string;
  updated_at: string;
}

export interface RecentRecord {
  id?: number;
  time: string;
  type: string;
  name: string;
  quantity: number;
}

/* ========== 物料库存 ========== */
const sortByLocation = <T extends { location: string }>(items: T[]): T[] =>
  items.sort((a, b) => {
    const na = parseInt(a.location, 10), nb = parseInt(b.location, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.location.localeCompare(b.location);
  });

export async function fetchMaterials(): Promise<MaterialItem[]> {
  const { data, error } = await supabase
    .from('material_inventory')
    .select('*');
  if (error) throw error;
  return sortByLocation(data || []);
}

export async function upsertMaterial(
  materialName: string,
  unit: string,
  quantity: number,
  location: string,
): Promise<void> {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16).replace('T', ' ');

  // 查找是否已存在同名+同库位的记录
  const { data: existing } = await supabase
    .from('material_inventory')
    .select('id, quantity')
    .eq('material_name', materialName)
    .eq('location', location)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('material_inventory')
      .update({ quantity: existing.quantity + quantity, updated_at: now })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('material_inventory')
      .insert({ material_name: materialName, unit, quantity, location, updated_at: now });
    if (error) throw error;
  }
}

export async function updateMaterialQty(
  id: number,
  newQuantity: number,
): Promise<void> {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16).replace('T', ' ');
  const { error } = await supabase
    .from('material_inventory')
    .update({ quantity: newQuantity, updated_at: now })
    .eq('id', id);
  if (error) throw error;
}

/* ========== 多余库存 (SKU) ========== */
export async function fetchSurplus(): Promise<SurplusItem[]> {
  const { data, error } = await supabase
    .from('surplus_inventory')
    .select('*');
  if (error) throw error;
  return sortByLocation(data || []);
}

export async function upsertSurplus(
  surplusCode: string,
  quantity: number,
  location: string,
): Promise<void> {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16).replace('T', ' ');

  const { data: existing } = await supabase
    .from('surplus_inventory')
    .select('id, quantity')
    .eq('surplus_code', surplusCode)
    .eq('location', location)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('surplus_inventory')
      .update({ quantity: existing.quantity + quantity, updated_at: now })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('surplus_inventory')
      .insert({ surplus_code: surplusCode, quantity, location, updated_at: now });
    if (error) throw error;
  }
}

export async function updateSurplusQty(
  id: number,
  newQuantity: number,
): Promise<void> {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 16).replace('T', ' ');
  const { error } = await supabase
    .from('surplus_inventory')
    .update({ quantity: newQuantity, updated_at: now })
    .eq('id', id);
  if (error) throw error;
}

/* ========== 最近变动记录 ========== */
export async function fetchRecent(): Promise<RecentRecord[]> {
  const { data, error } = await supabase
    .from('recent_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function addRecentRecord(
  time: string,
  type: string,
  name: string,
  quantity: number,
): Promise<void> {
  const { error } = await supabase
    .from('recent_records')
    .insert({ time, type, name, quantity });
  if (error) throw error;
}

/* ========== 用户认证 ========== */
export async function loginUser(
  username: string,
  password: string,
): Promise<{ operator_name: string } | null> {
  const { data, error } = await supabase
    .from('users')
    .select('operator_name')
    .eq('username', username)
    .eq('password', password)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function registerUser(
  username: string,
  password: string,
  operatorName: string,
): Promise<{ success: boolean; message: string }> {
  // 检查用户名是否已存在
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return { success: false, message: '用户名已存在' };
  }

  const { error } = await supabase
    .from('users')
    .insert({ username, password, operator_name: operatorName });

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: '注册成功' };
}

/* ========== 照片相关 ========== */
export interface PhotoRecord {
  id?: number;
  operator: string;
  photo_url: string;
  taken_at: string;
  location_text: string;
  created_at?: string;
}

export async function uploadPhoto(blob: Blob, filename: string): Promise<string> {
  const { error } = await supabase.storage
    .from('photos')
    .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('photos').getPublicUrl(filename);
  return data.publicUrl;
}

export async function savePhotoRecord(
  operator: string, photoUrl: string, takenAt: string, locationText: string,
): Promise<void> {
  const { error } = await supabase
    .from('photos')
    .insert({ operator, photo_url: photoUrl, taken_at: takenAt, location_text: locationText });
  if (error) throw error;
}

export async function fetchPhotos(limit = 50): Promise<PhotoRecord[]> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export function subscribePhotos(onInsert: (record: PhotoRecord) => void) {
  return supabase
    .channel('photos-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos' },
      (payload) => onInsert(payload.new as PhotoRecord))
    .subscribe();
}

function extractFilename(photoUrl: string): string {
  return photoUrl.split('/').pop() || '';
}

export async function deletePhoto(id: number, photoUrl: string): Promise<void> {
  const filename = extractFilename(photoUrl);
  if (filename) await supabase.storage.from('photos').remove([filename]);
  const { error } = await supabase.from('photos').delete().eq('id', id);
  if (error) throw error;
}

export async function deletePhotos(photos: { id: number; photo_url: string }[]): Promise<void> {
  const filenames = photos.map((p) => extractFilename(p.photo_url)).filter(Boolean);
  if (filenames.length) await supabase.storage.from('photos').remove(filenames);
  const ids = photos.map((p) => p.id);
  const { error } = await supabase.from('photos').delete().in('id', ids);
  if (error) throw error;
}
