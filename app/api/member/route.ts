import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const memberTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const claimFields = 'id,reward_id,tokens_spent,status,created_at';

function createDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

async function getMemberFromToken(request: Request, database: NonNullable<ReturnType<typeof createDatabase>>) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!memberTokenPattern.test(token)) return { member: null, error: null };
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const result = await database.from('market_waitlist')
    .select('id,referral_code,age_group,reward_path')
    .eq('member_access_token_hash', tokenHash)
    .limit(1)
    .maybeSingle();
  return { member: result.data, error: result.error };
}

export async function GET(request: Request) {
  const database = createDatabase();
  if (!database) return NextResponse.json({ error: 'Member progress is temporarily unavailable.' }, { status: 503 });

  const { member, error: memberError } = await getMemberFromToken(request, database);
  if (memberError || !member) {
    if (memberError) console.error('[WaitlistMember] Could not authenticate member dashboard:', memberError);
    return NextResponse.json({ error: memberError ? 'Member progress is temporarily unavailable.' : 'Open this dashboard from the device where you joined, or join the waitlist to set it up.' }, { status: memberError ? 503 : 401 });
  }

  const [credits, claims] = await Promise.all([
    database.from('waitlist_referral_credits').select('token_amount').eq('referrer_id', member.id),
    database.from('waitlist_reward_claims').select(claimFields).eq('referrer_id', member.id).order('created_at', { ascending: false }).limit(50)
  ]);
  if (credits.error || claims.error) {
    console.error('[WaitlistMember] Could not load referral progress:', credits.error || claims.error);
    return NextResponse.json({ error: 'Referral progress is temporarily unavailable. Please try again.' }, { status: 503 });
  }
  const earned = (credits.data || []).reduce((total, credit) => total + credit.token_amount, 0);
  const spent = (claims.data || [])
    .filter(claim => claim.status === 'pending' || claim.status === 'approved')
    .reduce((total, claim) => total + claim.tokens_spent, 0);
  return NextResponse.json({
    referralCode: member.referral_code,
    ageGroup: member.age_group,
    rewardPath: member.reward_path,
    referralsJoined: (credits.data || []).length,
    tokensEarned: earned,
    tokensAvailable: Math.max(0, earned - spent),
    claims: claims.data || []
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  let body: { memberToken?: unknown; rewardId?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'A valid souvenir request is required.' }, { status: 400 });
  }
  if (typeof body.memberToken !== 'string' || !memberTokenPattern.test(body.memberToken)
    || typeof body.rewardId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.rewardId)) {
    return NextResponse.json({ error: 'Open your personal dashboard and choose a valid souvenir.' }, { status: 400 });
  }
  const database = createDatabase();
  if (!database) return NextResponse.json({ error: 'Souvenir requests are temporarily unavailable.' }, { status: 503 });

  const { data: member, error: memberError } = await database.from('market_waitlist')
    .select('id,referral_code')
    .eq('member_access_token_hash', createHash('sha256').update(body.memberToken).digest('hex'))
    .limit(1)
    .maybeSingle();
  if (memberError || !member) {
    if (memberError) console.error('[WaitlistMember] Could not authenticate souvenir request:', memberError);
    return NextResponse.json({ error: 'This dashboard session is no longer valid. Join again from this device to refresh it.' }, { status: memberError ? 503 : 401 });
  }
  const { data, error } = await database.rpc('request_waitlist_reward', {
    p_referral_code: member.referral_code,
    p_reward_id: body.rewardId
  });
  if (error) {
    console.error('[WaitlistMember] Could not request souvenir:', error);
    const known = [
      'Referral link was not found.',
      'This souvenir is not available right now.',
      'You need '
    ];
    const message = known.some(prefix => error.message.startsWith(prefix))
      ? error.message
      : 'Your souvenir request could not be completed. Please try again.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ success: true, claimId: data }, { headers: { 'Cache-Control': 'no-store' } });
}
