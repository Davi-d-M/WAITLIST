import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return NextResponse.json({ error: 'Website content is not configured.' }, { status: 503 });
  const database = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await database.from('waitlist_site_content')
    .select('eyebrow,headline,intro,benefit_one,benefit_two,benefit_three,hero_image_url,hero_image_alt,age_group_tracks')
    .eq('id', 'default')
    .maybeSingle();
  if (error || !data) {
    console.error('[WaitlistSite] Could not load published website content:', error);
    return NextResponse.json({ error: 'Published website content could not be loaded.' }, { status: 503 });
  }
  const allowedAgeGroups = new Set(['18_20', '21_24', '25_34', '35_44', '45_plus']);
  const rawTracks = data.age_group_tracks && typeof data.age_group_tracks === 'object'
    ? data.age_group_tracks as Record<string, { title?: unknown; url?: unknown }>
    : {};
  const ageGroupTracks = Object.fromEntries(
    Object.entries(rawTracks)
      .filter(([group, track]) => {
        if (!allowedAgeGroups.has(group) || !track || typeof track !== 'object'
          || typeof track.title !== 'string' || typeof track.url !== 'string') return false;
        try {
          return new URL(track.url).protocol === 'https:';
        } catch {
          return false;
        }
      })
      .map(([group, track]) => [group, { title: track.title, url: track.url }])
  );
  const content = {
    eyebrow: data.eyebrow,
    headline: data.headline,
    intro: data.intro,
    benefit_one: data.benefit_one,
    benefit_two: data.benefit_two,
    benefit_three: data.benefit_three,
    hero_image_url: data.hero_image_url,
    hero_image_alt: data.hero_image_alt
  };
  return NextResponse.json({ content: { ...content, age_group_tracks: ageGroupTracks } }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
  });
}
