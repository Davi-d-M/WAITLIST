import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const allowedInterests = new Set([
  'Spirits', 'Wine', 'Beer', 'Champagne', 'Cocktails', 'Mixers',
  'Gift boxes', 'Snacks', 'Something else'
]);
const areas = [
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'CBD', latitude: -1.2864, longitude: 36.8172 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'Westlands', latitude: -1.2673, longitude: 36.8101 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'Kilimani', latitude: -1.2921, longitude: 36.7866 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'Lavington', latitude: -1.2744, longitude: 36.7764 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'Kileleshwa', latitude: -1.2741, longitude: 36.7878 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'Karen', latitude: -1.3197, longitude: 36.7073 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'Langata', latitude: -1.3612, longitude: 36.7506 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'South C', latitude: -1.3197, longitude: 36.8278 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'South B', latitude: -1.3233, longitude: 36.846 },
  { country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: 'Embakasi', latitude: -1.3192, longitude: 36.8958 },
  { country: 'Kenya', county: 'Machakos', city: 'Syokimau', area: 'Syokimau', latitude: -1.361, longitude: 36.9303 },
  { country: 'Kenya', county: 'Kajiado', city: 'Kitengela', area: 'Kitengela', latitude: -1.477, longitude: 36.9615 },
  { country: 'Kenya', county: 'Kajiado', city: 'Ongata Rongai', area: 'Rongai', latitude: -1.396, longitude: 36.759 },
  { country: 'Kenya', county: 'Kajiado', city: 'Ngong', area: 'Ngong', latitude: -1.361, longitude: 36.656 },
  { country: 'Kenya', county: 'Kiambu', city: 'Kikuyu', area: 'Kikuyu', latitude: -1.245, longitude: 36.662 },
  { country: 'Kenya', county: 'Kiambu', city: 'Thika', area: 'Thika Road', latitude: -1.0396, longitude: 37.09 },
  { country: 'Kenya', county: 'Mombasa', city: 'Mombasa', area: 'Nyali', latitude: -4.0435, longitude: 39.6682 },
  { country: 'Kenya', county: 'Mombasa', city: 'Mombasa', area: 'Mombasa Island', latitude: -4.062, longitude: 39.668 },
  { country: 'Kenya', county: 'Kisumu', city: 'Kisumu', area: 'Kisumu CBD', latitude: -0.0917, longitude: 34.768 },
  { country: 'Kenya', county: 'Kisumu', city: 'Kisumu', area: 'Milimani', latitude: -0.105, longitude: 34.755 },
  { country: 'Kenya', county: 'Uasin Gishu', city: 'Eldoret', area: 'Eldoret CBD', latitude: 0.5143, longitude: 35.2698 },
  { country: 'Kenya', county: 'Nakuru', city: 'Nakuru', area: 'Nakuru CBD', latitude: -0.3031, longitude: 36.08 }
];

const attempts = new Map<string, { since: number; count: number }>();
const maxAttempts = 12;
const windowMs = 15 * 60 * 1000;
const defaultLaunchAreas = [
  'CBD', 'Westlands', 'Kilimani', 'Lavington', 'Kileleshwa', 'Karen', 'Langata',
  'South C', 'South B', 'Embakasi', 'Roysambu', 'Kasarani', 'Kahawa', 'Githurai',
  'Zimmerman', 'Utawala', 'Syokimau', 'Kitengela', 'Rongai', 'Ngong', 'Kikuyu',
  'Thika Road', 'Mombasa Road'
];

type SignupBody = {
  action?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  country?: unknown;
  county?: unknown;
  city?: unknown;
  area?: unknown;
  landmark?: unknown;
  locationVerified?: unknown;
  locationAccuracy?: unknown;
  emailConsent?: unknown;
  smsConsent?: unknown;
  whatsappConsent?: unknown;
  preferredContactMethod?: unknown;
  productInterests?: unknown;
  orderFrequency?: unknown;
  rewardPath?: unknown;
  ageConfirmed?: unknown;
  ageGroup?: unknown;
  referralCode?: unknown;
  campaign?: unknown;
  source?: unknown;
  landingPage?: unknown;
  memberAccessToken?: unknown;
  website?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function createDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function missingDatabaseConfiguration() {
  const missing = [
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && 'NEXT_PUBLIC_SUPABASE_URL',
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && 'SUPABASE_SERVICE_ROLE_KEY'
  ].filter((name): name is string => Boolean(name));
  console.error(`[Waitlist] Missing server environment variables: ${missing.join(', ')}`);
  return NextResponse.json({
    error: `Waitlist storage is not configured. Add ${missing.join(' and ')} to this Vercel project's Environment Variables for Production, then redeploy.`
  }, { status: 503 });
}

function rateLimited(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const now = Date.now();
  const current = attempts.get(ip);
  if (current && now - current.since < windowMs && current.count >= maxAttempts) return true;
  if (!current || now - current.since >= windowMs) attempts.set(ip, { since: now, count: 1 });
  else current.count += 1;
  if (attempts.size > 2000) {
    for (const [key, value] of attempts) {
      if (now - value.since >= windowMs) attempts.delete(key);
    }
  }
  return false;
}

function distanceKm(latitude: number, longitude: number, target: typeof areas[number]) {
  const radians = Math.PI / 180;
  const dLat = (target.latitude - latitude) * radians;
  const dLon = (target.longitude - longitude) * radians;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(latitude * radians) * Math.cos(target.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveServiceArea(database: NonNullable<ReturnType<typeof createDatabase>>, area: string) {
  const environmentAreas = process.env.WAITLIST_LAUNCH_AREAS?.split(',').map(value => value.trim()).filter(Boolean);
  let launchAreas = environmentAreas?.length ? environmentAreas : defaultLaunchAreas;
  if (!environmentAreas?.length) {
    const { data, error } = await database.from('settings').select('value')
      .eq('key', 'logistics')
      .eq('is_published', true)
      .maybeSingle();
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        console.warn('[Waitlist] Published logistics settings are unavailable; using the storefront default launch areas.');
      } else {
        console.error('[Waitlist] Could not read configured launch areas:', error.message);
        throw new Error('Launch-area configuration could not be checked.');
      }
    } else if (data) {
      const configured = data.value && typeof data.value === 'object'
        ? (data.value as { dispatch_zones?: unknown }).dispatch_zones
        : null;
      if (Array.isArray(configured) && configured.every(value => typeof value === 'string')) {
        launchAreas = configured as string[];
      }
    }
  }
  if (!launchAreas.length) return 'unknown' as const;
  return launchAreas.some(value => value.toLowerCase() === area.toLowerCase())
    ? 'in_area' as const
    : 'outside_area' as const;
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  if (rateLimited(request)) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a little and try again.' }, { status: 429 });
  }
  const raw = await request.text();
  if (raw.length > 16_000) return NextResponse.json({ error: 'The submitted details are too large.' }, { status: 413 });
  let body: SignupBody;
  try {
    body = JSON.parse(raw) as SignupBody;
  } catch {
    return NextResponse.json({ error: 'The submitted details were invalid.' }, { status: 400 });
  }

  if (body.action === 'resolve') {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -5 || latitude > 6 || longitude < 33 || longitude > 42) {
      return NextResponse.json({ error: 'That location is outside the areas this site can identify. Enter your area manually.' }, { status: 400 });
    }
    const nearest = areas.map(area => ({ area, distance: distanceKm(latitude, longitude, area) }))
      .sort((a, b) => a.distance - b.distance)[0];
    const maxDistance = nearest.area.city === 'Nairobi' ? 8 : 20;
    if (nearest.distance > maxDistance) {
      return NextResponse.json({ error: 'We could not match that location to a known town. Enter your area manually.' }, { status: 404 });
    }
    return NextResponse.json({
      location: {
        country: nearest.area.country,
        county: nearest.area.county,
        city: nearest.area.city,
        area: nearest.area.area,
        verified: true,
        accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? Math.min(Math.round(accuracy), 100_000) : null
      }
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body.action !== 'signup') return NextResponse.json({ error: 'Choose a valid waitlist action.' }, { status: 400 });
  if (text(body.website, 200)) return NextResponse.json({ success: true });

  const email = text(body.email, 254).toLowerCase();
  const phone = text(body.phone, 32);
  const fullName = text(body.fullName, 120);
  const country = text(body.country, 80) || 'Kenya';
  const county = text(body.county, 80);
  const city = text(body.city, 100);
  const area = text(body.area, 100);
  const landmark = text(body.landmark, 120);
  const emailConsent = body.emailConsent === true;
  const smsConsent = body.smsConsent === true;
  const whatsappConsent = body.whatsappConsent === true;
  const contactMethod = text(body.preferredContactMethod, 20);
  const interests = Array.isArray(body.productInterests)
    ? body.productInterests.filter((value): value is string => typeof value === 'string' && allowedInterests.has(value)).slice(0, 9)
    : [];
  const validRewardPaths = new Set(['wine', 'adventure', 'music']);
  const rewardPath = text(body.rewardPath, 20);
  const frequency = text(body.orderFrequency, 30);
  const ageGroup = text(body.ageGroup, 20);
  const validAgeGroups = new Set(['18_20', '21_24', '25_34', '35_44', '45_plus']);
  const validFrequencies = new Set(['weekly', 'few_monthly', 'monthly', 'occasions', 'depends']);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (!city || !area || !county) return NextResponse.json({ error: 'Enter your county, town and area.' }, { status: 400 });
  if (!emailConsent && !smsConsent && !whatsappConsent) {
    return NextResponse.json({ error: 'Select at least one channel for your early-access updates.' }, { status: 400 });
  }
  if ((smsConsent || whatsappConsent) && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
    return NextResponse.json({ error: 'Enter a valid phone number for SMS or WhatsApp updates.' }, { status: 400 });
  }
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
    return NextResponse.json({ error: 'Enter a valid phone number or leave it blank.' }, { status: 400 });
  }
  if (!validFrequencies.has(frequency) && frequency) {
    return NextResponse.json({ error: 'Choose a valid order frequency.' }, { status: 400 });
  }
  if (contactMethod && !(
    (contactMethod === 'email' && emailConsent)
    || (contactMethod === 'sms' && smsConsent)
    || (contactMethod === 'whatsapp' && whatsappConsent)
  )) {
    return NextResponse.json({ error: 'Preferred contact must be a channel you selected.' }, { status: 400 });
  }
  if (body.ageConfirmed !== true) {
    return NextResponse.json({ error: 'Confirm that you are of legal drinking age to join the list.' }, { status: 400 });
  }
  if (!validAgeGroups.has(ageGroup)) {
    return NextResponse.json({ error: 'Choose an adult age range to join the list.' }, { status: 400 });
  }
  if (!validRewardPaths.has(rewardPath)) {
    return NextResponse.json({ error: 'Choose the experience you are most excited about.' }, { status: 400 });
  }

  const database = createDatabase();
  if (!database) return missingDatabaseConfiguration();
  let serviceAreaStatus: 'in_area' | 'outside_area' | 'unknown';
  try {
    serviceAreaStatus = await resolveServiceArea(database, area);
  } catch (cause) {
    console.error('[Waitlist] Could not determine area availability:', cause);
    return NextResponse.json({
      error: 'We could not check area availability right now. Please try again in a moment.'
    }, { status: 503 });
  }
  const now = new Date().toISOString();
  const { data: existingRows, error: lookupError } = await database.from('market_waitlist')
    .select('id,city,area,referral_code,member_access_token_hash')
    .eq('email', email)
    .limit(100);
  if (lookupError) {
    console.error('[Waitlist] Could not check for an existing signup:', lookupError);
    return NextResponse.json({ error: 'The early-access list is temporarily unavailable.' }, { status: 503 });
  }
  const existing = existingRows?.find(row =>
    row.city.toLowerCase() === city.toLowerCase() && row.area.toLowerCase() === area.toLowerCase()
  );
  if (existing) {
    const presentedToken = text(body.memberAccessToken, 100);
    const presentedHash = createHash('sha256').update(presentedToken).digest();
    const storedHash = typeof existing.member_access_token_hash === 'string'
      ? Buffer.from(existing.member_access_token_hash, 'hex')
      : Buffer.alloc(0);
    const tokenMatches = /^[A-Za-z0-9_-]{43}$/.test(presentedToken)
      && storedHash.length === presentedHash.length
      && timingSafeEqual(storedHash, presentedHash);
    if (!tokenMatches) {
      return NextResponse.json({
        error: 'You are already on the early-access list for this area. Open your personal dashboard on the device where you joined; we did not create another signup or change your account.'
      }, { status: 409 });
    }
    return NextResponse.json({
      success: true,
      alreadyJoined: true,
      serviceAreaStatus,
      referralCode: existing.referral_code,
      memberAccessToken: presentedToken
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const memberAccessToken = randomBytes(32).toString('base64url');
  const newReferralCode = `OB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const values = {
    full_name: fullName || null,
    email,
    phone: phone || null,
    country,
    county,
    city,
    area,
    landmark: landmark || null,
    location_verified: body.locationVerified === true,
    location_accuracy_m: typeof body.locationAccuracy === 'number' && Number.isFinite(body.locationAccuracy)
      ? Math.max(0, Math.min(Math.round(body.locationAccuracy), 100_000))
      : null,
    service_area_status: serviceAreaStatus,
    notification_consent: true,
    email_updates_consent: emailConsent,
    email_updates_consent_at: emailConsent ? now : null,
    sms_consent: smsConsent,
    sms_consent_at: smsConsent ? now : null,
    whatsapp_consent: whatsappConsent,
    whatsapp_consent_at: whatsappConsent ? now : null,
    preferred_contact_method: contactMethod || null,
    product_interests: interests,
    reward_path: rewardPath,
    order_frequency: frequency || null,
    age_group: ageGroup,
    age_confirmed: true,
    age_confirmed_at: now,
    referral_code: newReferralCode,
    referred_by_code: text(body.referralCode, 40) || null,
    member_access_token_hash: createHash('sha256').update(memberAccessToken).digest('hex'),
    campaign: text(body.campaign, 120) || null,
    landing_page: text(body.landingPage, 200) || '/',
    consent_version: 'waitlist-2026-01',
    source: /^[a-z0-9 _-]{1,60}$/i.test(text(body.source, 60)) ? text(body.source, 60) : 'waitlist-website',
    status: 'WAITLIST',
    notified_at: null,
    unsubscribed_at: null,
    user_id: null,
    updated_at: now
  };
  const result = await database.from('market_waitlist').insert(values);
  if (result.error) {
    console.error('[Waitlist] Could not save signup:', result.error);
    if (result.error.code === '42P01' || result.error.code === 'PGRST205' || result.error.code === '42703') {
      return NextResponse.json({
        error: 'The shared waitlist database has not been upgraded yet. Apply supabase/WAITLIST_SITE_MIGRATION.sql after DEMAND_INTELLIGENCE_MIGRATION.sql.'
      }, { status: 503 });
    }
    return NextResponse.json({ error: 'Your signup could not be saved. Please try again.' }, { status: 503 });
  }
  return NextResponse.json({ success: true, serviceAreaStatus, referralCode: newReferralCode, memberAccessToken }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
