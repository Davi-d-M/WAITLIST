import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const concepts = new Set(['character_cosplay', 'horror_halloween', 'original_outfit', 'group_duo', 'undecided']);
const outfitStatuses = new Set(['fully_ready', 'idea_needs_help', 'source_most', 'finishing_touches', 'undecided']);
const budgets = new Set(['under_2000', 'kes_2000_5000', 'kes_5000_10000', 'above_10000', 'need_ideas']);
const groupPlans = new Set(['solo', 'partner', 'group', 'find_group']);
const services = new Set([
  'finding_outfit', 'styling', 'makeup_sfx', 'wig_hair',
  'props_accessories', 'tailoring', 'costume_maker', 'inspiration_tutorials'
]);
const channels = new Set(['email', 'sms', 'whatsapp']);
const attempts = new Map<string, { since: number; count: number }>();

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

function rateLimited(request: Request) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
  const now = Date.now();
  const current = attempts.get(address);
  if (current && now - current.since < 15 * 60_000 && current.count >= 20) return true;
  if (!current || now - current.since >= 15 * 60_000) attempts.set(address, { since: now, count: 1 });
  else current.count += 1;
  if (attempts.size > 2000) {
    for (const [key, value] of attempts) {
      if (now - value.since >= 15 * 60_000) attempts.delete(key);
    }
  }
  return false;
}

async function resolveMember(db: NonNullable<ReturnType<typeof database>>, request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!tokenPattern.test(token)) return { memberId: null, error: null };
  const hash = createHash('sha256').update(token).digest('hex');
  const member = await db.from('market_waitlist')
    .select('id')
    .eq('member_access_token_hash', hash)
    .maybeSingle();
  if (member.error) return { memberId: null, error: member.error };
  if (member.data?.id) return { memberId: member.data.id as string, error: null };

  const session = await db.from('waitlist_member_sessions')
    .select('member_id')
    .eq('token_hash', hash)
    .maybeSingle();
  if (session.error) return { memberId: null, error: session.error };
  return { memberId: (session.data?.member_id as string | undefined) || null, error: null };
}

function unavailable(dbError?: { code?: string } | null) {
  const missing = dbError && ['42P01', 'PGRST205', 'PGRST204'].includes(dbError.code || '');
  return NextResponse.json({
    error: missing
      ? 'Fit Studio is not set up yet. Apply supabase/WAITLIST_FIT_STUDIO_MIGRATION.sql in the shared Supabase project.'
      : 'Fit Studio is temporarily unavailable. Please try again.'
  }, { status: 503 });
}

export async function GET(request: Request) {
  const db = database();
  if (!db) return unavailable();
  const { memberId, error: authError } = await resolveMember(db, request);
  if (authError) {
    console.error('[FitStudio] Could not verify member access:', authError.code);
    return unavailable(authError);
  }
  if (!memberId) {
    return NextResponse.json({ error: 'Open Fit Studio from your waitlist confirmation or member pass.' }, { status: 401 });
  }

  const [profileResult, consentResult, settingsResult] = await Promise.all([
    db.from('fit_profiles')
      .select('id,concept,character_theme,outfit_status,budget_range,group_plan,status,created_at,updated_at,fit_help_requests(service_key)')
      .eq('member_id', memberId)
      .maybeSingle(),
    db.from('fit_consent_records')
      .select('id,purpose,channel,granted,captured_at')
      .eq('member_id', memberId)
      .order('captured_at', { ascending: false })
      .order('id', { ascending: false }),
    db.from('fit_studio_settings')
      .select('title,intro,merchant_notice')
      .eq('id', 'default')
      .single()
  ]);
  const error = profileResult.error || consentResult.error || settingsResult.error;
  if (error) {
    console.error('[FitStudio] Could not load member profile:', error.code);
    return unavailable(error);
  }
  const currentConsent = {
    fitServiceUpdates: {} as Record<string, boolean>,
    providerIntroduction: {} as Record<string, boolean>
  };
  for (const item of consentResult.data || []) {
    const group = item.purpose === 'provider_introduction'
      ? currentConsent.providerIntroduction
      : currentConsent.fitServiceUpdates;
    if (!(item.channel in group)) group[item.channel] = item.granted;
  }
  return NextResponse.json({
    profile: profileResult.data || null,
    consent: currentConsent,
    settings: settingsResult.data
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  if (rateLimited(request)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, { status: 429 });
  }
  const db = database();
  if (!db) return unavailable();
  const { memberId, error: authError } = await resolveMember(db, request);
  if (authError) {
    console.error('[FitStudio] Could not verify member access for save:', authError.code);
    return unavailable(authError);
  }
  if (!memberId) {
    return NextResponse.json({ error: 'Your member session could not be verified. Reopen your member pass and try again.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 16_000) return NextResponse.json({ error: 'The submitted details are too large.' }, { status: 413 });
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Review your answers and try again.' }, { status: 400 });
  }
  const concept = typeof body.concept === 'string' ? body.concept : '';
  const characterTheme = typeof body.characterTheme === 'string' ? body.characterTheme.trim().slice(0, 120) : '';
  const outfitStatus = typeof body.outfitStatus === 'string' ? body.outfitStatus : '';
  const budgetRange = body.budgetRange === '' || body.budgetRange == null
    ? null
    : typeof body.budgetRange === 'string' ? body.budgetRange : '';
  const groupPlan = typeof body.groupPlan === 'string' ? body.groupPlan : '';
  const helpRequested = Array.isArray(body.helpRequested)
    ? [...new Set(body.helpRequested.filter((value): value is string => typeof value === 'string'))]
    : [];
  const wantsUpdates = body.wantsFitServiceUpdates === true;
  const consentChannels = Array.isArray(body.consentChannels)
    ? [...new Set(body.consentChannels.filter((value): value is string => typeof value === 'string'))]
    : [];
  const wantsProviderIntroduction = body.wantsProviderIntroduction === true;
  const providerChannels = Array.isArray(body.providerChannels)
    ? [...new Set(body.providerChannels.filter((value): value is string => typeof value === 'string'))]
    : [];

  if (!concepts.has(concept) || !outfitStatuses.has(outfitStatus)
    || !groupPlans.has(groupPlan) || (budgetRange !== null && !budgets.has(budgetRange))
    || helpRequested.length < 1 || helpRequested.some(value => !services.has(value))
    || consentChannels.length > channels.size || consentChannels.some(value => !channels.has(value))
    || (wantsUpdates && consentChannels.length === 0)
    || providerChannels.length > channels.size || providerChannels.some(value => !channels.has(value))
    || (wantsProviderIntroduction && providerChannels.length === 0)) {
    return NextResponse.json({
      error: 'Choose a valid answer for each required question. Each optional consent needs at least one selected channel.'
    }, { status: 400 });
  }

  const { data: profileId, error } = await db.rpc('save_waitlist_fit_profile', {
    p_member_id: memberId,
    p_concept: concept,
    p_character_theme: characterTheme || null,
    p_outfit_status: outfitStatus,
    p_help_requested: helpRequested,
    p_budget_range: budgetRange,
    p_group_plan: groupPlan,
    p_wants_fit_service_updates: wantsUpdates,
    p_consent_channels: consentChannels,
    p_wants_provider_introduction: wantsProviderIntroduction,
    p_provider_channels: providerChannels
  });
  if (error || !profileId) {
    console.error('[FitStudio] Could not save member profile:', error?.code);
    if (error && ['42P01', 'PGRST202', '42883'].includes(error.code || '')) return unavailable(error);
    return NextResponse.json({ error: 'Your Fit Studio profile could not be saved. Please try again.' }, { status: 503 });
  }
  return NextResponse.json({ success: true, profileId }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
