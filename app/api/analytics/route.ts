import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ageGroups = new Set(['18_20', '21_24', '25_34', '35_44', '45_plus']);
const musicGenres = new Set(['reggae', 'genge', 'gengetone', 'soul', 'rnb', 'classic', 'love_romance', 'afrobeats', 'hip_hop', 'pop', 'other']);
const eventTypes = new Set(['page_open', 'age_group_selected', 'music_started', 'music_heard_80']);
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'A valid analytics event is required.' }, { status: 400 });
  }

  const eventType = typeof body.eventType === 'string' ? body.eventType : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const ageGroup = typeof body.ageGroup === 'string' ? body.ageGroup : null;
  const trackTitle = typeof body.trackTitle === 'string' ? body.trackTitle.trim() : null;
  const musicGenre = typeof body.musicGenre === 'string' ? body.musicGenre : null;
  if (!eventTypes.has(eventType) || !sessionIdPattern.test(sessionId)) {
    return NextResponse.json({ error: 'The analytics event is invalid.' }, { status: 400 });
  }
  if (ageGroup && !ageGroups.has(ageGroup)) {
    return NextResponse.json({ error: 'The age group is invalid.' }, { status: 400 });
  }
  if (musicGenre && !musicGenres.has(musicGenre)) {
    return NextResponse.json({ error: 'The music genre is invalid.' }, { status: 400 });
  }
  if (eventType === 'age_group_selected' && !ageGroup) {
    return NextResponse.json({ error: 'An age group is required for this event.' }, { status: 400 });
  }
  if (eventType === 'music_started' || eventType === 'music_heard_80') {
    if (!ageGroup || !trackTitle || trackTitle.length > 120) {
      return NextResponse.json({ error: 'A valid age group and track are required for this event.' }, { status: 400 });
    }
  } else if (trackTitle || musicGenre) {
    return NextResponse.json({ error: 'A track is not expected for this event.' }, { status: 400 });
  }

  const database = getDatabase();
  if (!database) {
    console.error('[WaitlistAnalytics] Supabase server configuration is missing.');
    return NextResponse.json({ error: 'Waitlist analytics are not configured.' }, { status: 503 });
  }

  if (eventType === 'music_started' || eventType === 'music_heard_80') {
    const { data: content, error: contentError } = await database.from('waitlist_site_content')
      .select('age_group_tracks,genre_tracks')
      .eq('id', 'default')
      .maybeSingle();
    if (contentError) {
      console.error('[WaitlistAnalytics] Could not validate the published music assignment:', contentError);
      return NextResponse.json({ error: 'The published music assignment could not be verified.' }, { status: 503 });
    }
    const tracks = (musicGenre ? content?.genre_tracks : content?.age_group_tracks) as Record<string, { title?: unknown }> | null;
    const assignedTrack = musicGenre ? tracks?.[musicGenre] : tracks?.[ageGroup as string];
    if (!assignedTrack || assignedTrack.title !== trackTitle) {
      return NextResponse.json({ error: musicGenre ? 'The track is not currently assigned to this genre.' : 'The track is not currently assigned to this age group.' }, { status: 400 });
    }
  }

  const { error } = await database.from('waitlist_site_analytics_events').insert({
    session_id: sessionId,
    event_type: eventType,
    age_group: ageGroup,
    music_genre: musicGenre,
    track_title: trackTitle
  });
  if (error) {
    console.error('[WaitlistAnalytics] Could not record the event:', error);
    return NextResponse.json({ error: 'The waitlist analytics event could not be recorded.' }, { status: 503 });
  }

  return NextResponse.json({ recorded: true }, { headers: { 'Cache-Control': 'no-store' } });
}
