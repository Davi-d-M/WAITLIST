import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET() {
  const database = getDatabase();
  if (!database) {
    console.error('[WaitlistFitStudioPublic] Server database configuration is missing.');
    return NextResponse.json({ error: 'Published Fit Studio listings are temporarily unavailable.' }, { status: 503 });
  }

  const pageSize = 500;
  const offerings = [];
  try {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await database
        .from('fit_service_offerings')
        .select('id,service_key,title,description,image_url,price_kes,available,updated_at')
        .eq('published', true)
        .order('updated_at', { ascending: false })
        .range(from, from + pageSize - 1)
        .abortSignal(AbortSignal.timeout(15_000));

      if (error) {
        console.error('[WaitlistFitStudioPublic] Could not load published listings:', error.code);
        return NextResponse.json({ error: 'Published Fit Studio listings are temporarily unavailable.' }, { status: 503 });
      }

      offerings.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
  } catch (error) {
    console.error('[WaitlistFitStudioPublic] Listing request failed:', error);
    return NextResponse.json({ error: 'Published Fit Studio listings are temporarily unavailable.' }, { status: 503 });
  }

  return NextResponse.json({ offerings }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' }
  });
}
