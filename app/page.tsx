'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

const areasByCity: Record<string, { county: string; areas: string[] }> = {
  Nairobi: {
    county: 'Nairobi',
    areas: ['CBD', 'Westlands', 'Kilimani', 'Lavington', 'Kileleshwa', 'Karen', 'Langata', 'South C', 'South B', 'Embakasi', 'Roysambu', 'Kasarani']
  },
  Mombasa: { county: 'Mombasa', areas: ['Nyali', 'Mombasa Island'] },
  Kisumu: { county: 'Kisumu', areas: ['Kisumu CBD', 'Milimani'] },
  Eldoret: { county: 'Uasin Gishu', areas: ['Eldoret CBD'] },
  Nakuru: { county: 'Nakuru', areas: ['Nakuru CBD'] },
  Other: { county: '', areas: [] }
};

const interests = ['Spirits', 'Wine', 'Beer', 'Champagne', 'Cocktails', 'Mixers', 'Gift boxes', 'Snacks', 'Something else'];
const frequencies = [
  ['weekly', 'Once a week'],
  ['few_monthly', 'A few times a month'],
  ['monthly', 'Once a month'],
  ['occasions', 'For special occasions'],
  ['depends', 'It depends']
];

type SignupResult = { success?: boolean; serviceAreaStatus?: 'in_area' | 'outside_area' | 'unknown'; referralCode?: string; error?: string };
type Location = { country: string; county: string; city: string; area: string; verified: boolean; accuracy: number | null };
type SiteContent = {
  eyebrow: string;
  headline: string;
  intro: string;
  benefit_one: string;
  benefit_two: string;
  benefit_three: string;
  hero_image_url: string | null;
  hero_image_alt: string;
  age_group_tracks: Record<string, { title: string; url: string }>;
};
const ageGroups = [
  { id: '18_20', label: '18–20' },
  { id: '21_24', label: '21–24' },
  { id: '25_34', label: '25–34' },
  { id: '35_44', label: '35–44' },
  { id: '45_plus', label: '45+' }
];
const defaultSiteContent: SiteContent = {
  eyebrow: 'A BETTER NIGHT STARTS HERE',
  headline: 'Something good is coming.',
  intro: 'Your next drink night is about to get a lot easier. Online Bar is bringing your favorites to your door, starting in selected areas.',
  benefit_one: 'Priority access',
  benefit_two: 'Launch surprises',
  benefit_three: 'Area-first delivery',
  hero_image_url: null,
  hero_image_alt: 'Online Bar early access',
  age_group_tracks: {}
};

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [siteContent, setSiteContent] = useState<SiteContent>(defaultSiteContent);
  const [siteContentLoaded, setSiteContentLoaded] = useState(false);
  const [ageGateComplete, setAgeGateComplete] = useState(false);
  const [adultConfirmedAtEntry, setAdultConfirmedAtEntry] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicNotice, setMusicNotice] = useState('');
  const [step, setStep] = useState(0);
  const [location, setLocation] = useState<Location>({
    country: 'Kenya', county: 'Nairobi', city: 'Nairobi', area: '', verified: false, accuracy: null
  });
  const [customCity, setCustomCity] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consents, setConsents] = useState({ email: false, sms: false, whatsapp: false });
  const [preferredContactMethod, setPreferredContactMethod] = useState<'email' | 'sms' | 'whatsapp' | ''>('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [frequency, setFrequency] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [serviceAreaStatus, setServiceAreaStatus] = useState<SignupResult['serviceAreaStatus']>('unknown');
  const [referralCode, setReferralCode] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');

  useEffect(() => {
    void fetch('/api/content', { cache: 'no-store' })
      .then(async response => {
        const result = await response.json() as { content?: SiteContent; error?: string };
        if (!response.ok || !result.content) throw new Error(result.error || 'Published content could not be loaded.');
        setSiteContent({ ...defaultSiteContent, ...result.content });
      })
      .catch(cause => {
        console.error('[WaitlistSite] Using default landing page content:', cause);
      })
      .finally(() => {
        setSiteContentLoaded(true);
      });
  }, []);

  const areas = useMemo(() => areasByCity[location.city]?.areas || [], [location.city]);
  const hasPhoneConsent = consents.sms || consents.whatsapp;
  const resolvedArea = customArea.trim() || location.area;
  const resolvedCity = location.city === 'Other' ? customCity.trim() : location.city;
  const updatesAllowed = consents.email || consents.sms || consents.whatsapp;
  const selectedAgeGroup = ageGroups.find(group => group.id === ageGroup);
  const currentAgeTrack = ageGroup ? siteContent.age_group_tracks[ageGroup] : undefined;

  const enterSite = () => {
    if (!selectedAgeGroup || !adultConfirmedAtEntry) return;
    setAgeGateComplete(true);
    setMusicNotice('');
    if (currentAgeTrack && audioRef.current) {
      audioRef.current.src = currentAgeTrack.url;
      void audioRef.current.play()
        .then(() => setMusicPlaying(true))
        .catch(() => setMusicNotice('Tap “Play music” to start your age-group track.'));
    }
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
      return;
    }
    setMusicNotice('');
    void audio.play()
      .then(() => setMusicPlaying(true))
      .catch(() => setMusicNotice('This track could not be played in your browser.'));
  };

  const requestLocation = () => {
    setError('');
    setGpsStatus('');
    if (!navigator.geolocation) {
      setGpsStatus('Location is unavailable in this browser. Enter your area instead.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resolve',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        });
        const result = await response.json() as { location?: Location; error?: string };
        if (!response.ok || !result.location) throw new Error(result.error || 'We could not identify your approximate area.');
        setLocation(result.location);
        setCustomArea('');
        setGpsStatus(`Approximate area found: ${result.location.area}, ${result.location.city}. You can change it below.`);
      } catch (cause) {
        setGpsStatus(cause instanceof Error ? cause.message : 'We could not identify your approximate area. Enter it manually.');
      } finally {
        setBusy(false);
      }
    }, () => {
      setBusy(false);
      setGpsStatus('Location permission was not available. You can still enter your area manually.');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!resolvedArea || !resolvedCity || !location.county.trim()) {
      setError('Enter your county, town and area so we can plan local availability.');
      setStep(1);
      return;
    }
    if (!updatesAllowed) {
      setError('Select at least one update channel so we know where to send your early-access invitation.');
      return;
    }
    if (hasPhoneConsent && !phone.trim()) {
      setError('Add a phone number for SMS or WhatsApp updates, or deselect those channels.');
      return;
    }
    if (!ageConfirmed) {
      setError('Confirm that you are of legal drinking age to join the list.');
      return;
    }
    if (!ageGroup || !selectedAgeGroup) {
      setError('Choose your adult age range to join the list.');
      return;
    }
    setBusy(true);
    try {
      const query = new URLSearchParams(window.location.search);
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signup',
          fullName,
          email,
          phone,
          country: location.country,
          county: location.county || areasByCity[location.city]?.county || 'Unspecified',
          city: resolvedCity,
          area: resolvedArea,
          landmark,
          locationVerified: location.verified,
          locationAccuracy: location.accuracy,
          emailConsent: consents.email,
          smsConsent: consents.sms,
          whatsappConsent: consents.whatsapp,
          preferredContactMethod,
          productInterests: selectedInterests,
          orderFrequency: frequency,
          ageGroup,
          ageConfirmed,
          referralCode: query.get('ref') || '',
          campaign: query.get('utm_campaign') || '',
          source: query.get('utm_source') || query.get('ref') ? 'campaign' : 'waitlist-website',
          landingPage: window.location.pathname,
          website
        })
      });
      const result = await response.json() as SignupResult;
      if (!response.ok) throw new Error(result.error || 'Your signup could not be saved.');
      setServiceAreaStatus(result.serviceAreaStatus || 'unknown');
      setReferralCode(result.referralCode || '');
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your signup could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const changeCity = (city: string) => {
    setLocation(current => ({
      ...current,
      city,
      county: areasByCity[city]?.county || '',
      area: '',
      verified: false,
      accuracy: null
    }));
    setCustomCity('');
    setCustomArea('');
  };

  const setManualArea = (area: string) => {
    setLocation(current => ({ ...current, area, verified: false, accuracy: null }));
    setCustomArea('');
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(current => current.includes(interest)
      ? current.filter(value => value !== interest)
      : [...current, interest]);
  };

  const share = async () => {
    const url = new URL(window.location.href);
    if (referralCode) url.searchParams.set('ref', referralCode);
    try {
      if (navigator.share) await navigator.share({ title: 'Online Bar early access', text: 'Join me on the Online Bar early-access list.', url: url.toString() });
      else {
        await navigator.clipboard.writeText(url.toString());
        setGpsStatus('Your invite link was copied.');
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== 'AbortError') setGpsStatus('We could not share the link from this browser.');
    }
  };

  return (
    <main className="site-shell">
      <nav className="topbar"><Link className="brand" href="/" aria-label="Online Bar home"><span className="brand-mark">OB</span><span>ONLINE BAR<span className="brand-sub">GOOD TIMES, DELIVERED</span></span></Link><span className="top-status"><i /> EARLY ACCESS</span></nav>
      <audio ref={audioRef} loop preload="none" onEnded={() => setMusicPlaying(false)} />
      {!ageGateComplete && (
        <section className="age-gate">
          <p className="eyebrow"><span /> ONLINE BAR EARLY ACCESS</p>
          <h1>First, are you <em>18+?</em></h1>
          <p>This experience is for adults of legal drinking age. Choose an age range; we do not ask for your date of birth. Your range is only saved if you join the waitlist.</p>
          <label className="age-gate-select">Your age range<select value={ageGroup} onChange={event => setAgeGroup(event.target.value)}><option value="">Choose an adult age range</option>{ageGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
          <label className="check-row age-row"><input type="checkbox" checked={adultConfirmedAtEntry} onChange={event => setAdultConfirmedAtEntry(event.target.checked)} /><span>I confirm I am 18 or older.</span></label>
          <p className="privacy-note">Music starts only after you choose your age range and continue. You can pause it anytime.</p>
          <button className="button button-primary" disabled={!siteContentLoaded || !ageGroup || !adultConfirmedAtEntry} onClick={enterSite}>{siteContentLoaded ? 'Enter & play' : 'Loading…'} <span>↗</span></button>
          {!currentAgeTrack && siteContentLoaded && <p className="inline-note">No track is assigned to this age range yet. You can still continue.</p>}
        </section>
      )}
      {ageGateComplete && (
        <div className="music-control">
          <span>{currentAgeTrack ? currentAgeTrack.title : 'Music not set for this range'}</span>
          {currentAgeTrack && <button type="button" onClick={toggleMusic}>{musicPlaying ? 'Pause music' : 'Play music'}</button>}
          {musicNotice && <span role="status">{musicNotice}</span>}
        </div>
      )}
      {ageGateComplete && <>
      {step === 0 && (
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> {siteContent.eyebrow}</p>
            <h1>{siteContent.headline}</h1>
            <p className="hero-intro">{siteContent.intro}</p>
            <button className="button button-primary" onClick={() => setStep(1)}>Get early access <span>↗</span></button>
            <div className="benefits">{[siteContent.benefit_one, siteContent.benefit_two, siteContent.benefit_three].map(benefit => <span key={benefit}>✦ {benefit}</span>)}</div>
          </div>
          <div className={`hero-art${siteContent.hero_image_url ? ' has-photo' : ''}`} role="img" aria-label={siteContent.hero_image_url ? siteContent.hero_image_alt : 'Online Bar early access'} style={siteContent.hero_image_url ? { backgroundImage: `url("${siteContent.hero_image_url.replaceAll('"', '%22')}")` } : undefined}><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="glass">✦</div><div className="art-label"><b>01</b><span>THE GOOD<br />STUFF IS NEAR</span></div><div className="art-note">FIRST IN.<br />FIRST POUR.</div></div>
          <footer className="hero-footer"><span>NAIROBI · KENYA</span><span>18+ · RESPONSIBLE ENJOYMENT</span><span>YOUR NEIGHBOURHOOD, NEXT</span></footer>
        </section>
      )}

      {(step === 1 || step === 2) && (
        <section className="form-layout">
          <div className="form-aside"><p className="eyebrow"><span /> YOUR EARLY ACCESS</p><h1>{step === 1 ? 'First, your neighbourhood.' : 'Make it yours.'}</h1><p>We’re opening in selected areas first. Your area helps us plan where to go next.</p><div className="steps"><span className={step === 1 ? 'current' : 'complete'}>01</span><i /><span className={step === 2 ? 'current' : ''}>02</span><i /><span>03</span></div><small>LOCATION <b>·</b> YOUR DETAILS <b>·</b> YOU’RE IN</small></div>
          {step === 1 ? (
            <div className="form-card">
              <p className="eyebrow">STEP 01 — DELIVERY AREA</p><h2>Where should we deliver?</h2><p className="muted">Share an approximate location or enter your area. GPS is optional.</p>
              <button type="button" className="button button-outline" onClick={requestLocation} disabled={busy}>⌖ {busy ? 'Finding your area…' : 'Use my current location'}</button>
              {gpsStatus && <p className="inline-note" role="status">{gpsStatus}</p>}
              <div className="divider"><span>OR ENTER IT YOURSELF</span></div>
              <label>Town / city<select value={location.city} onChange={event => changeCity(event.target.value)}>{[...Object.keys(areasByCity), 'Other'].filter((city, index, all) => all.indexOf(city) === index).map(city => <option key={city}>{city}</option>)}</select></label>
              {location.city === 'Other' && <>
                <label>Town / city<input value={customCity} onChange={event => setCustomCity(event.target.value)} placeholder="Your town or city" maxLength={100} /></label>
                <label>County<input value={location.county} onChange={event => setLocation(current => ({ ...current, county: event.target.value }))} placeholder="Your county" maxLength={80} /></label>
              </>}
              {areas.length > 0 && <label>Estate / neighbourhood<select value={location.area} onChange={event => setManualArea(event.target.value)}><option value="">Choose an area</option>{areas.map(area => <option key={area}>{area}</option>)}</select></label>}
              <label>Enter an area {areas.length ? <span className="optional">(or add a more specific estate)</span> : null}<input value={customArea} onChange={event => { setCustomArea(event.target.value); if (event.target.value) setLocation(current => ({ ...current, verified: false, accuracy: null })); }} placeholder="e.g. Westlands, Kilimani, Nyali" maxLength={100} /></label>
              <label>Nearby landmark <span className="optional">OPTIONAL</span><input value={landmark} onChange={event => setLandmark(event.target.value)} placeholder="A nearby place to help us understand demand" maxLength={120} /></label>
              <p className="privacy-note">We use your area to plan launch availability. Exact GPS coordinates are used only to find an approximate area and are not saved.</p>
              <button className="button button-primary full" disabled={busy || !resolvedArea || !resolvedCity || !location.county.trim()} onClick={() => setStep(2)}>Continue <span>→</span></button>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
          ) : (
            <form className="form-card" onSubmit={submit}>
              <p className="eyebrow">STEP 02 — YOUR INVITATION</p><h2>Where should we reach you?</h2><p className="muted">For {resolvedArea}, {location.city}. Outside our first areas? Join anyway — we’re listening.</p>
              <label>Your name<input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Name" maxLength={120} /></label>
              <label>Email address<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} /></label>
              <label>Phone number <span className="optional">OPTIONAL UNLESS YOU CHOOSE SMS / WHATSAPP</span><input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+254 7XX XXX XXX" maxLength={32} /></label>
              <p className="inline-note">Age range selected: {selectedAgeGroup?.label}. Your age range is used for launch planning and personalized music.</p>
              <fieldset><legend>How may we send your early-access update?</legend>
                {(['email', 'sms', 'whatsapp'] as const).map(channel => <label className="check-row" key={channel}><input type="checkbox" checked={consents[channel]} onChange={event => setConsents(current => ({ ...current, [channel]: event.target.checked }))} /><span>{channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp'} updates</span></label>)}
              </fieldset>
              {updatesAllowed && <label>Preferred contact method<select value={preferredContactMethod} onChange={event => setPreferredContactMethod(event.target.value as typeof preferredContactMethod)}><option value="">No preference</option>{consents.email && <option value="email">Email</option>}{consents.sms && <option value="sms">SMS</option>}{consents.whatsapp && <option value="whatsapp">WhatsApp</option>}</select></label>}
              <fieldset><legend>What would you love to see? <span className="optional">OPTIONAL · SELECT ANY</span></legend><div className="interest-grid">{interests.map(item => <button type="button" key={item} className={`interest ${selectedInterests.includes(item) ? 'selected' : ''}`} aria-pressed={selectedInterests.includes(item)} onClick={() => toggleInterest(item)}>{item}</button>)}</div></fieldset>
              <label>How often do you usually order? <span className="optional">OPTIONAL</span><select value={frequency} onChange={event => setFrequency(event.target.value)}><option value="">Choose one</option>{frequencies.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="check-row age-row"><input type="checkbox" required checked={ageConfirmed} onChange={event => setAgeConfirmed(event.target.checked)} /><span>I confirm that I am of legal drinking age. This is not a substitute for age checks when purchasing or receiving alcohol.</span></label>
              <label className="trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label>
              <p className="privacy-note">We’ll only use the contact channels you selected for early-access updates. You can opt out later.</p>
              <div className="button-row"><button type="button" className="button button-ghost" onClick={() => { setError(''); setStep(1); }}>← Back</button><button className="button button-primary" disabled={busy}>{busy ? 'Joining…' : 'Join early access'} <span>↗</span></button></div>
              {error && <p className="error" role="alert">{error}</p>}
            </form>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="success-card">
          <div className="success-icon">✦</div><p className="eyebrow">YOU’RE ON THE LIST</p><h1>You’re in.<br /><em>Cheers.</em></h1>
          <p className="success-copy">{serviceAreaStatus === 'in_area' ? `We’re planning for ${resolvedArea}, ${resolvedCity}. You’ll hear from us before we open there.` : serviceAreaStatus === 'outside_area' ? `${resolvedArea}, ${resolvedCity} is outside our currently configured launch areas, but we’ve recorded the demand and will keep you posted.` : `We’ve recorded demand for ${resolvedArea}, ${resolvedCity}. We’ll confirm availability as launch areas are finalized.`}</p>
          <p className="success-copy">You’re now on the Online Bar early-access list. Keep an eye on the contact channel(s) you selected.</p>
          {referralCode && <p className="referral">YOUR INVITE CODE <b>{referralCode}</b></p>}
          <button className="button button-primary" onClick={share}>Invite a friend <span>↗</span></button>
          {gpsStatus && <p className="inline-note" role="status">{gpsStatus}</p>}
        </section>
      )}
      </>}
      <footer className="site-footer"><span>ONLINE BAR</span><span>GOOD TIMES, DELIVERED.</span><a href="https://onlinebar.co.ke/privacy">PRIVACY</a></footer>
    </main>
  );
}
