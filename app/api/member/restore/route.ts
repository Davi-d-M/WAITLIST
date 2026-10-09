import { createHmac, createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function createDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  let body: { fullName?: unknown; phoneLastThree?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Enter your name and the last three digits of your phone number.' }, { status: 400 });
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 120) : '';
  const phoneLastThree = typeof body.phoneLastThree === 'string' ? body.phoneLastThree.trim() : '';
  if (fullName.length < 2 || !/^\d{3}$/.test(phoneLastThree)) {
    return NextResponse.json({ error: 'Enter the name you used to join and exactly three phone digits.' }, { status: 400 });
  }

  const database = createDatabase();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!database || !serviceKey) {
    return NextResponse.json({ error: 'Waitlist recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  const clientAddress = request.headers.get('x-real-ip')?.trim() || forwardedFor;
  if (!clientAddress) {
    return NextResponse.json({ error: 'Waitlist recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
  }

  const sessionToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  const requestHash = createHmac('sha256', serviceKey).update(clientAddress).digest('hex');
  const { data, error } = await database.rpc('restore_waitlist_member_session', {
    p_full_name: fullName,
    p_phone_last_three: phoneLastThree,
    p_session_token_hash: tokenHash,
    p_request_hash: requestHash
  });

  if (error) {
    console.error('[WaitlistMember] Could not restore member session:', error);
    return NextResponse.json({ error: 'Waitlist recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
  }

  if (data?.rate_limited) {
    return NextResponse.json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, { status: 429 });
  }

  if (typeof data?.member_id !== 'string') {
    return NextResponse.json({ error: 'We could not find one matching waitlist entry. Check your name and phone digits, or contact support if you joined without a phone number.' }, { status: 404 });
  }

  const member = await database.from('market_waitlist')
    .select('referral_code')
    .eq('id', data.member_id)
    .maybeSingle();
  if (member.error || !member.data) {
    if (member.error) console.error('[WaitlistMember] Could not load restored member referral code:', member.error);
    return NextResponse.json({ error: 'Waitlist recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    memberToken: sessionToken,
    referralCode: member.data.referral_code
  }, { headers: { 'Cache-Control': 'no-store' } });
}
