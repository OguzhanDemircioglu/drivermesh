import { supabase } from './supabase';
import { demo, isDemoActive } from '@/demo/store';

export type Hq = {
  lat: number | null;
  lng: number | null;
  address: string | null;
};

export async function getHq(orgId: string): Promise<Hq | null> {
  if (isDemoActive()) {
    const h = demo.hq();
    return h ? { lat: h.lat, lng: h.lng, address: h.address } : null;
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('hq_lat, hq_lng, hq_address')
    .eq('id', orgId)
    .maybeSingle();
  if (error) {
    console.warn('[hq] fetch failed', error.message);
    return null;
  }
  if (!data) return null;
  return { lat: data.hq_lat, lng: data.hq_lng, address: data.hq_address };
}

export async function saveHq(orgId: string, hq: Hq): Promise<void> {
  if (isDemoActive()) {
    if (hq.lat == null || hq.lng == null) return;
    demo.setHq({ lat: hq.lat, lng: hq.lng, address: hq.address?.trim() || '' });
    return;
  }
  const { error } = await supabase
    .from('organizations')
    .update({
      hq_lat: hq.lat,
      hq_lng: hq.lng,
      hq_address: hq.address?.trim() || null,
    })
    .eq('id', orgId);
  if (error) throw error;
}
