import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const recoveryAttempts = new Map<string, { windowStartedAt: number; count: number }>();
const recoveryWindowMs = 15 * 60 * 1000;
const maxRecoveryAttempts = 10;

function createDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key
    ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase().replace(/[\s\p{P}]/gu, '');
}

function isMissingSessionTable(error: { code?: string; message?: string }) {
  return ['42P01', 'PGRST205'].includes(error.code || '')
    || /waitlist_member_sessions/i.test(error.message || '');
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }

  let body: { fullName?: unknown; email?: unknown; phoneLastThree?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Enter your signup name, email and the last three digits of your phone number.' }, { status: 400 });
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 120) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254).toLowerCase() : '';
  const phoneLastThree = typeof body.phoneLastThree === 'string' ? body.phoneLastThree.trim() : '';
  if (
    fullName.length < 2
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !/^\d{3}$/.test(phoneLastThree)
  ) {
    return NextResponse.json({ error: 'Enter the name and email you used to join, plus exactly three phone digits.' }, { status: 400 });
  }

  const database = createDatabase();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!database || !serviceKey) {
    return NextResponse.json({ error: 'Waitlist recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientAddress = request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-vercel-forwarded-for')?.trim()
    || forwardedFor;
  if (!clientAddress) {
    console.error('[WaitlistMember] Recovery was blocked because the hosting platform did not provide a client address for throttling.');
    return NextResponse.json({ error: 'Waitlist recovery could not verify this request. Refresh the page and try again.' }, { status: 503 });
  }

  const now = Date.now();
  const attempts = recoveryAttempts.get(clientAddress);
  if (attempts && now - attempts.windowStartedAt < recoveryWindowMs && attempts.count >= maxRecoveryAttempts) {
    return NextResponse.json({ error: 'Too many attempts. Please wait 15 minutes and try again.' }, { status: 429 });
  }
  if (!attempts || now - attempts.windowStartedAt >= recoveryWindowMs) {
    recoveryAttempts.set(clientAddress, { windowStartedAt: now, count: 1 });
  } else {
    attempts.count += 1;
  }
  if (recoveryAttempts.size > 2000) {
    for (const [address, attempt] of recoveryAttempts) {
      if (now - attempt.windowStartedAt >= recoveryWindowMs) recoveryAttempts.delete(address);
    }
  }

  const sessionToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  const { data: candidates, error: lookupError } = await database.from('market_waitlist')
    .select('id,full_name,email,phone,referral_code')
    .eq('email', email)
    .limit(1000);
  if (lookupError) {
    console.error('[WaitlistMember] Could not look up signup for recovery:', lookupError);
    return NextResponse.json({ error: 'Waitlist recovery could not check your signup right now. Please try again later.' }, { status: 503 });
  }

  const requestedName = normalizedName(fullName);
  if (requestedName.length < 2 || candidates?.length === 1000) {
    return NextResponse.json({
      error: 'We could not find one matching waitlist entry. Check the name, signup email and last three digits of the same phone number. You can enter your first or full name; capitalization, spaces and punctuation do not matter. If you still cannot find your entry, contact support.'
    }, { status: 404 });
  }
  const matchingMembers = (candidates || []).filter(member => {
    const storedName = typeof member.full_name === 'string' ? normalizedName(member.full_name) : '';
    const digits = typeof member.phone === 'string' ? member.phone.replace(/\D/g, '') : '';
    return member.email.toLowerCase() === email
      && storedName.startsWith(requestedName)
      && digits.length >= 3
      && digits.endsWith(phoneLastThree);
  });
  if (matchingMembers.length !== 1) {
    return NextResponse.json({
      error: 'We could not find one matching waitlist entry. Check the name, signup email and last three digits of the same phone number. You can enter your first or full name; capitalization, spaces and punctuation do not matter. If you still cannot find your entry, contact support.'
    }, { status: 404 });
  }

  const recoveredMember = matchingMembers[0];
  const { error: sessionError } = await database.from('waitlist_member_sessions').insert({
    token_hash: tokenHash,
    member_id: recoveredMember.id
  });
  if (sessionError && !isMissingSessionTable(sessionError)) {
    console.error('[WaitlistMember] Could not create recovered member session:', sessionError);
    return NextResponse.json({ error: 'Waitlist recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
  if (sessionError) {
    const { error: tokenError } = await database.from('market_waitlist')
      .update({ member_access_token_hash: tokenHash })
      .eq('id', recoveredMember.id);
    if (tokenError) {
      console.error('[WaitlistMember] Could not save recovered member session:', tokenError);
      return NextResponse.json({ error: 'Waitlist recovery is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
  }

  return NextResponse.json({
    success: true,
    memberToken: sessionToken,
    referralCode: recoveredMember.referral_code
  }, { headers: { 'Cache-Control': 'no-store' } });
}
