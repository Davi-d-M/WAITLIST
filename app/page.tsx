'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const musicGenres = [
  { id: 'reggae', label: 'Reggae' },
  { id: 'genge', label: 'Genge' },
  { id: 'gengetone', label: 'Gengetone' },
  { id: 'soul', label: 'Soul' },
  { id: 'rnb', label: 'R&B' },
  { id: 'classic', label: 'Classics' },
  { id: 'love_romance', label: 'Love & Romance' },
  { id: 'afrobeats', label: 'Afrobeats' },
  { id: 'hip_hop', label: 'Hip-hop' },
  { id: 'pop', label: 'Pop' },
  { id: 'other', label: 'Other' }
];

type SignupResult = { success?: boolean; alreadyJoined?: boolean; serviceAreaStatus?: 'in_area' | 'outside_area' | 'unknown'; referralCode?: string; memberAccessToken?: string; error?: string };
type RestoreMemberResult = { success?: boolean; memberToken?: string; referralCode?: string; error?: string };
type Location = { country: string; county: string; city: string; area: string; verified: boolean; accuracy: number | null };
type RewardPath = 'wine' | 'adventure' | 'music';
type SavedMemberProfile = {
  fullName: string | null;
  email: string;
  phone: string | null;
  country: string;
  county: string;
  city: string;
  area: string;
  landmark: string | null;
  productInterests: string[];
  orderFrequency: string | null;
  emailConsent: boolean;
  smsConsent: boolean;
  whatsappConsent: boolean;
  preferredContactMethod: 'email' | 'sms' | 'whatsapp' | null;
};
declare global {
  interface Window {
    OnlineBarNative?: {
      saveMemberProgress: (referralCode: string, memberAccessToken: string, ageGroup: string) => void;
    };
  }
}
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
  genre_tracks: Record<string, { title: string; url: string }>;
  launch_at: string | null;
  tokens_per_referral: number;
};
type SiteReward = { id: string; name: string; description: string; image_url: string | null; token_cost: number; sort_order: number };
type MemberProgress = { referralsJoined: number; tokensEarned: number; tokensAvailable: number; error?: string };
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
  age_group_tracks: {},
  genre_tracks: {},
  launch_at: null,
  tokens_per_referral: 10
};

function getShareLabel(ageGroup: string) {
  if (ageGroup === '18_20' || ageGroup === '21_24') return 'Share the buzz';
  if (ageGroup === '25_34' || ageGroup === '35_44') return 'Tell a friend';
  return 'Whisper to a friend';
}

const rewardPaths: Array<{ id: RewardPath; title: string; description: string; icon: string }> = [
  { id: 'wine', title: 'Wine & good living', description: 'Wine tastings, special invitations and curated gifts.', icon: '🍷' },
  { id: 'adventure', title: 'Adventure & experiences', description: 'A hosted adventure and a complimentary gift for you and a friend.', icon: '🌍' },
  { id: 'music', title: 'Music & madness', description: 'A chance to win Soul Fest tickets and special access.', icon: '🎟️' }
];

function countdownParts(launchAt: string | null, now: number) {
  if (!launchAt) return null;
  const remaining = new Date(launchAt).getTime() - now;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true };
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1000),
    launched: false
  };
}

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicFadeRef = useRef<number | null>(null);
  const activeTrackUrlRef = useRef('');
  const analyticsSessionRef = useRef<string | null>(null);
  const pageOpenRecordedRef = useRef(false);
  const musicQualifiedRef = useRef(false);
  const [siteContent, setSiteContent] = useState<SiteContent>(defaultSiteContent);
  const [siteContentLoaded, setSiteContentLoaded] = useState(false);
  const [refreshingTracks, setRefreshingTracks] = useState(false);
  const [siteRewards, setSiteRewards] = useState<SiteReward[]>([]);
  const [memberProgress, setMemberProgress] = useState<MemberProgress | null>(null);
  const [now, setNow] = useState(0);
  const [ageGateComplete, setAgeGateComplete] = useState(false);
  const [adultConfirmedAtEntry, setAdultConfirmedAtEntry] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [musicGenre, setMusicGenre] = useState('');
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
  const [rewardPath, setRewardPath] = useState<RewardPath | ''>('');
  const [frequency, setFrequency] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [serviceAreaStatus, setServiceAreaStatus] = useState<SignupResult['serviceAreaStatus']>('unknown');
  const [referralCode, setReferralCode] = useState('');
  const [memberAccessToken, setMemberAccessToken] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [savedMemberProfile, setSavedMemberProfile] = useState<SavedMemberProfile | null>(null);
  const [restoringMember, setRestoringMember] = useState(true);
  const [savedMemberError, setSavedMemberError] = useState('');
  const [recoveryName, setRecoveryName] = useState('');
  const [recoveryPhoneLastThree, setRecoveryPhoneLastThree] = useState('');
  const [recoveringMember, setRecoveringMember] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [memberRecovered, setMemberRecovered] = useState(false);
  const shareDialogCloseRef = useRef<HTMLButtonElement>(null);

  const loadPublishedContent = useCallback(async () => {
    try {
      const response = await fetch('/api/content', { cache: 'no-store' });
      const result = await response.json() as { content?: SiteContent; rewards?: SiteReward[]; error?: string };
      if (!response.ok || !result.content) throw new Error(result.error || 'Published content could not be loaded.');
      setSiteContent({ ...defaultSiteContent, ...result.content });
      setSiteRewards(result.rewards || []);
    } catch (cause) {
      console.error('[WaitlistSite] Could not refresh published content:', cause);
      setMusicNotice('Could not check for new music right now. Please try again.');
    } finally {
      setSiteContentLoaded(true);
      setRefreshingTracks(false);
    }
  }, []);

  useEffect(() => {
    void loadPublishedContent();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadPublishedContent();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadPublishedContent]);

  useEffect(() => {
    const accessToken = window.localStorage.getItem('waitlist-member-token') || '';
    if (!accessToken) {
      setRestoringMember(false);
      return;
    }

    void fetch('/api/member', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async response => {
        const result = await response.json() as {
          referralCode?: string;
          ageGroup?: string | null;
          rewardPath?: RewardPath | null;
          profile?: SavedMemberProfile;
          error?: string;
        };
        if (response.status === 401) {
          window.localStorage.removeItem('waitlist-member-token');
          window.localStorage.removeItem('waitlist-referral-code');
          throw new Error('This device’s saved waitlist session has expired. Please contact us to recover your existing signup; do not sign up again for the same area.');
        }
        if (!response.ok || !result.profile || !result.referralCode) {
          throw new Error(result.error || 'Your saved waitlist details could not be restored. Please try again.');
        }

        const profile = result.profile;
        const cityIsKnown = Object.prototype.hasOwnProperty.call(areasByCity, profile.city) && profile.city !== 'Other';
        const savedAreaIsKnown = cityIsKnown && areasByCity[profile.city].areas.includes(profile.area);
        setSavedMemberProfile(profile);
        setFullName(profile.fullName || '');
        setEmail(profile.email);
        setPhone(profile.phone || '');
        setLocation(current => ({
          ...current,
          country: profile.country || current.country,
          county: profile.county || current.county,
          city: cityIsKnown ? profile.city : 'Other',
          area: savedAreaIsKnown ? profile.area : ''
        }));
        setCustomCity(cityIsKnown ? '' : profile.city);
        setCustomArea(savedAreaIsKnown ? '' : profile.area);
        setLandmark(profile.landmark || '');
        setSelectedInterests(profile.productInterests);
        setFrequency(profile.orderFrequency || '');
        setConsents({
          email: profile.emailConsent,
          sms: profile.smsConsent,
          whatsapp: profile.whatsappConsent
        });
        setPreferredContactMethod(profile.preferredContactMethod || '');
        if (result.ageGroup && ageGroups.some(group => group.id === result.ageGroup)) setAgeGroup(result.ageGroup);
        if (result.rewardPath && rewardPaths.some(path => path.id === result.rewardPath)) setRewardPath(result.rewardPath);
        setReferralCode(result.referralCode);
        setMemberAccessToken(accessToken);
      })
      .catch(cause => {
        console.error('[WaitlistSite] Could not restore returning member details:', cause);
        setSavedMemberError(cause instanceof Error ? cause.message : 'Your saved details could not be restored.');
      })
      .finally(() => setRestoringMember(false));
  }, []);

  const recordAnalytics = useCallback((eventType: string, selectedAgeGroup?: string, trackTitle?: string, selectedGenre?: string) => {
    let sessionId = analyticsSessionRef.current;
    if (!sessionId) {
      try {
        sessionId = window.sessionStorage.getItem('waitlist-analytics-session') || crypto.randomUUID();
        window.sessionStorage.setItem('waitlist-analytics-session', sessionId);
      } catch (cause) {
        console.error('[WaitlistSite] Could not save the anonymous analytics session:', cause);
        return;
      }
      analyticsSessionRef.current = sessionId;
    }
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, sessionId, ageGroup: selectedAgeGroup || null, trackTitle: trackTitle || null, musicGenre: selectedGenre || null })
    }).then(async response => {
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || 'The anonymous analytics event was not recorded.');
      }
    }).catch(cause => {
      console.error('[WaitlistSite] Could not record anonymous site analytics:', cause);
    });
  }, []);

  useEffect(() => {
    if (!pageOpenRecordedRef.current) {
      pageOpenRecordedRef.current = true;
      recordAnalytics('page_open');
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(cause => {
        console.error('[WaitlistSite] Could not register the home-screen dashboard:', cause);
      });
    }
    return () => window.clearInterval(timer);
  }, [recordAnalytics]);

  useEffect(() => () => {
    if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
  }, []);

  useEffect(() => {
    if (!shareDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShareDialogOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    shareDialogCloseRef.current?.focus();
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [shareDialogOpen]);

  useEffect(() => {
    if (!referralCode || step !== 3) return;
    window.localStorage.setItem('waitlist-referral-code', referralCode);
    if (!memberAccessToken) return;
    void fetch('/api/member', { cache: 'no-store', headers: { Authorization: `Bearer ${memberAccessToken}` } })
      .then(async response => {
        const result = await response.json() as MemberProgress;
        if (!response.ok) throw new Error(result.error || 'Your referral progress could not be loaded.');
        setMemberProgress(result);
      })
      .catch(cause => {
        console.error('[WaitlistSite] Could not load referral progress:', cause);
      });
  }, [memberAccessToken, referralCode, step]);

  const areas = useMemo(() => areasByCity[location.city]?.areas || [], [location.city]);
  const hasPhoneConsent = consents.sms || consents.whatsapp;
  const resolvedArea = customArea.trim() || location.area;
  const resolvedCity = location.city === 'Other' ? customCity.trim() : location.city;
  const updatesAllowed = consents.email || consents.sms || consents.whatsapp;
  const selectedAgeGroup = ageGroups.find(group => group.id === ageGroup);
  const currentTrack = musicGenre
    ? siteContent.genre_tracks[musicGenre]
    : ageGroup ? siteContent.age_group_tracks[ageGroup] : undefined;

  const startMusic = (audio: HTMLAudioElement, trackUrl?: string, trackTitle?: string, selectedGenre = musicGenre) => {
    if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
    musicFadeRef.current = null;
    musicQualifiedRef.current = false;
    if (trackUrl) {
      audio.src = trackUrl;
      activeTrackUrlRef.current = trackUrl;
    }
    audio.volume = 0.03;
    void audio.play()
      .then(() => {
        setMusicPlaying(true);
        recordAnalytics('music_started', ageGroup, trackTitle || currentTrack?.title, selectedGenre || undefined);
        musicFadeRef.current = window.setInterval(() => {
          const nextVolume = Math.min(audio.volume + 0.015, 0.3);
          audio.volume = nextVolume;
          if (nextVolume >= 0.3 && musicFadeRef.current !== null) {
            window.clearInterval(musicFadeRef.current);
            musicFadeRef.current = null;
          }
        }, 400);
      })
      .catch(() => {
        setMusicPlaying(false);
        setMusicNotice('Tap “Play music” to start your selected track.');
      });
  };

  const enterSite = () => {
    if (!selectedAgeGroup || !adultConfirmedAtEntry) return;
    recordAnalytics('age_group_selected', ageGroup);
    setAgeGateComplete(true);
    setMusicNotice('');
    if (currentTrack && audioRef.current) {
      startMusic(audioRef.current, currentTrack.url, currentTrack.title);
    }
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicPlaying) {
      if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
      musicFadeRef.current = null;
      audio.pause();
      setMusicPlaying(false);
      return;
    }
    setMusicNotice('');
    startMusic(audio, currentTrack?.url, currentTrack?.title);
  };

  const changeMusicGenre = (genre: string) => {
    setMusicGenre(genre);
    if (!ageGateComplete) return;
    const track = genre ? siteContent.genre_tracks[genre] : siteContent.age_group_tracks[ageGroup];
    const audio = audioRef.current;
    if (!audio) return;
    if (!track) {
      if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
      musicFadeRef.current = null;
      audio.pause();
      setMusicPlaying(false);
      setMusicNotice('No song is uploaded for that style yet. Choose another genre or your age-group mix.');
      return;
    }
    setMusicNotice('');
    startMusic(audio, track.url, track.title, genre);
  };

  useEffect(() => {
    if (!ageGateComplete || !musicPlaying || !currentTrack || activeTrackUrlRef.current === currentTrack.url) return;
    const audio = audioRef.current;
    if (audio) startMusic(audio, currentTrack.url, currentTrack.title, musicGenre);
  }, [ageGateComplete, currentTrack?.title, currentTrack?.url, musicGenre, musicPlaying]);

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
    if (!rewardPath) {
      setError('Choose the experience you are most excited about.');
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
          rewardPath,
          orderFrequency: frequency,
          ageGroup,
          ageConfirmed,
          referralCode: query.get('ref') || '',
          campaign: query.get('utm_campaign') || '',
          source: query.get('utm_source') || query.get('ref') ? 'campaign' : 'waitlist-website',
          landingPage: window.location.pathname,
          memberAccessToken: window.localStorage.getItem('waitlist-member-token') || '',
          website
        })
      });
      const result = await response.json() as SignupResult;
      if (!response.ok) throw new Error(result.error || 'Your signup could not be saved.');
      setServiceAreaStatus(result.serviceAreaStatus || 'unknown');
      const personalCode = result.referralCode || '';
      setReferralCode(personalCode);
      if (personalCode) window.localStorage.setItem('waitlist-referral-code', personalCode);
      const accessToken = result.memberAccessToken || '';
      setMemberAccessToken(accessToken);
      if (accessToken) window.localStorage.setItem('waitlist-member-token', accessToken);
      if (personalCode && accessToken) {
        window.OnlineBarNative?.saveMemberProgress(personalCode, accessToken, ageGroup);
      }
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your signup could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const restoreMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryError('');
    setRecoveringMember(true);
    try {
      const response = await fetch('/api/member/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: recoveryName, phoneLastThree: recoveryPhoneLastThree })
      });
      const result = await response.json() as RestoreMemberResult;
      if (!response.ok || !result.memberToken || !result.referralCode) {
        throw new Error(result.error || 'Your waitlist page could not be restored. Please try again.');
      }
      window.localStorage.setItem('waitlist-member-token', result.memberToken);
      window.localStorage.setItem('waitlist-referral-code', result.referralCode);
      setMemberAccessToken(result.memberToken);
      setReferralCode(result.referralCode);
      setMemberRecovered(true);
    } catch (cause) {
      setRecoveryError(cause instanceof Error ? cause.message : 'Your waitlist page could not be restored. Please try again.');
    } finally {
      setRecoveringMember(false);
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

  const openShareChooser = () => {
    const url = new URL(`/invite/${encodeURIComponent(referralCode)}`, window.location.origin);
    const text = ageGroup === '18_20' || ageGroup === '21_24'
      ? `Share the buzz: join me on the Online Bar early-access list. My invite: ${url.toString()}`
      : ageGroup === '45_plus'
        ? `A little whisper for you: join me on the Online Bar early-access list. My invite: ${url.toString()}`
        : `Tell a friend to join the Online Bar early-access waitlist. My invite: ${url.toString()}`;
    setShareLink(url.toString());
    setShareMessage(text);
    setGpsStatus('');
    setShareDialogOpen(true);
  };
  const copyShareMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setGpsStatus('Your invite message and personal link are copied and ready to share.');
    } catch (cause) {
      console.error('[WaitlistSite] Could not copy the invite message:', cause);
      setGpsStatus('We could not copy the invite. Allow clipboard access or copy your invite link manually.');
    }
  };
  const shareToApp = async (app: 'instagram' | 'snapchat') => {
    const appUrl = app === 'instagram' ? 'https://www.instagram.com/' : 'https://www.snapchat.com/';
    window.open(appUrl, '_blank', 'noopener,noreferrer');
    try {
      await navigator.clipboard.writeText(shareMessage);
      setGpsStatus(`Your invite is copied. Paste it into your ${app === 'instagram' ? 'Instagram message or story' : 'Snapchat chat'} to share.`);
    } catch (cause) {
      console.error(`[WaitlistSite] Could not copy the invite for ${app}:`, cause);
      setGpsStatus(`Copy your invite link here, then paste it into ${app === 'instagram' ? 'Instagram' : 'Snapchat'}.`);
    }
  };
  const countdown = countdownParts(siteContent.launch_at, now);
  const shareLabel = getShareLabel(ageGroup);
  const widgetUrl = '/widget';

  return (
    <main className="site-shell">
      <nav className="topbar"><Link className="brand" href="/" aria-label="Online Bar home"><span className="brand-mark">OB</span><span>ONLINE BAR<span className="brand-sub">GOOD TIMES, DELIVERED</span></span></Link><span className="top-status"><i /> EARLY ACCESS</span></nav>
      <audio ref={audioRef} loop preload="none" onTimeUpdate={event => {
        const audio = event.currentTarget;
        if (!musicQualifiedRef.current && currentTrack && audio.duration > 0 && audio.currentTime / audio.duration >= 0.8) {
          musicQualifiedRef.current = true;
          recordAnalytics('music_heard_80', ageGroup, currentTrack.title, musicGenre || undefined);
        }
      }} onEnded={() => {
        if (musicFadeRef.current !== null) window.clearInterval(musicFadeRef.current);
        musicFadeRef.current = null;
        setMusicPlaying(false);
      }} />
      {!ageGateComplete && (
        <section className="age-gate">
          <p className="eyebrow"><span /> ONLINE BAR EARLY ACCESS</p>
          <h1>First, are you <em>18+?</em></h1>
          <p>This experience is for adults of legal drinking age. Choose an age range and the music you love; we do not ask for your date of birth. Your range is only saved if you join the waitlist.</p>
          <label className="age-gate-select">Your age range<select value={ageGroup} onChange={event => setAgeGroup(event.target.value)}><option value="">Choose an adult age range</option>{ageGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
          <label className="age-gate-select">Your music style<select value={musicGenre} onChange={event => changeMusicGenre(event.target.value)}><option value="">Play my age-group mix</option>{musicGenres.map(genre => <option key={genre.id} value={genre.id} disabled={!siteContent.genre_tracks[genre.id]}>{genre.label}{siteContent.genre_tracks[genre.id] ? '' : ' · no song yet'}</option>)}</select></label>
          <p className="inline-note">Skip choosing a style and we’ll automatically play the song uploaded for your age group when you tap “Enter &amp; play”.</p>
          {Object.keys(siteContent.genre_tracks).length === 0 && <p className="inline-note">Pick your age range for now. Genre tracks are coming soon.</p>}
          <label className="check-row age-row"><input type="checkbox" checked={adultConfirmedAtEntry} onChange={event => setAdultConfirmedAtEntry(event.target.checked)} /><span>I confirm I am 18 or older.</span></label>
          <p className="privacy-note">Music starts softly after you continue, then gradually gets louder. You can pause it anytime. We count anonymous site opens and age-group track listens to learn what resonates; activity is not linked to signup details. The area heat map uses only the neighbourhood members choose to share when joining.</p>
          <button className="button button-primary" disabled={!siteContentLoaded || !ageGroup || !adultConfirmedAtEntry} onClick={enterSite}>{siteContentLoaded ? 'Enter & play' : 'Loading…'} <span>↗</span></button>
          {!restoringMember && savedMemberProfile && <aside className="returning-member-card">
            <p className="eyebrow"><span /> WELCOME BACK{savedMemberProfile.fullName ? `, ${savedMemberProfile.fullName.split(' ')[0].toUpperCase()}` : ''}</p>
            <p>You’re already on the waitlist. Your details have been restored on this device — there’s no need to sign up again.</p>
            <Link className="button button-outline" href={widgetUrl}>Continue to my waitlist dashboard <span>↗</span></Link>
          </aside>}
          {savedMemberError && <p className="error" role="alert">{savedMemberError}</p>}
          {!restoringMember && !savedMemberProfile && <aside className="returning-member-card recovery-card">
            <p className="eyebrow"><span /> ALREADY JOINED?</p>
            {memberRecovered ? <>
              <p>Your waitlist page is ready. Your referrals, tokens and rewards are saved to your existing entry.</p>
              <Link className="button button-outline" href={widgetUrl}>Open my waitlist page <span>↗</span></Link>
            </> : <>
              <p>Find your existing waitlist page without signing up again. Enter the name and phone number you used when signing up. Capitalization, spaces and punctuation in your name do not matter.</p>
              <form className="recovery-form" onSubmit={restoreMember}>
                <label>Your signup name<input autoComplete="name" maxLength={120} value={recoveryName} onChange={event => setRecoveryName(event.target.value)} required /></label>
                <label>Last three phone digits (no spaces)<input autoComplete="off" inputMode="numeric" pattern="[0-9]{3}" maxLength={3} value={recoveryPhoneLastThree} onChange={event => setRecoveryPhoneLastThree(event.target.value.replace(/\D/g, '').slice(0, 3))} required /></label>
                {recoveryError && <p className="error" role="alert">{recoveryError}</p>}
                <button className="button button-primary" type="submit" disabled={recoveringMember || recoveryName.trim().length < 2 || recoveryPhoneLastThree.length !== 3}>
                  {recoveringMember ? 'Finding your page…' : 'Find my waitlist page'} <span>↗</span>
                </button>
              </form>
            </>}
          </aside>}
          {!currentTrack && siteContentLoaded && <p className="inline-note">{musicGenre ? 'No track is assigned to that genre yet.' : 'No track is assigned to this age range yet.'} You can still continue.</p>}
        </section>
      )}
      {ageGateComplete && (
        <div className="music-control">
          <label className="music-genre-control">Music style
            <select aria-label="Choose music style" value={musicGenre} onChange={event => changeMusicGenre(event.target.value)}>
              <option value="">My age-group mix</option>
              {musicGenres.map(genre => <option key={genre.id} value={genre.id} disabled={!siteContent.genre_tracks[genre.id]}>{genre.label}{siteContent.genre_tracks[genre.id] ? '' : ' · no song yet'}</option>)}
            </select>
          </label>
          <span>{currentTrack ? `Now playing: ${currentTrack.title}` : 'Music not set for this choice'}</span>
          <button type="button" disabled={refreshingTracks} onClick={() => { setRefreshingTracks(true); void loadPublishedContent(); }}>{refreshingTracks ? 'Checking for new songs…' : 'Check for new songs'}</button>
          {currentTrack && <button type="button" onClick={toggleMusic}>{musicPlaying ? 'Pause music' : 'Play music'}</button>}
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
            <aside className="halloween-invite" aria-label="Halloween party invitation opportunity">
              <span className="halloween-invite-icon" aria-hidden="true">✦</span>
              <div>
                <p className="halloween-invite-eyebrow">A LITTLE HALLOWEEN MAGIC</p>
                <h2>A night to remember.</h2>
                <p>Join the early-access list for a chance to receive a special invitation to our Halloween-themed party. The location and event details will be shared with invited guests in due time.</p>
              </div>
            </aside>
            <button className="button button-primary" onClick={() => setStep(1)}>Get early access <span>↗</span></button>
            {countdown && <div className="countdown-strip"><b>{countdown.launched ? 'WE ARE LIVE' : 'LAUNCH COUNTDOWN'}</b><span>{countdown.launched ? 'The wait is over.' : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`}</span></div>}
            <aside className="countdown-nudge">
              <span className="countdown-nudge-icon" aria-hidden="true">⌂</span>
              <div><b>Keep the countdown on your phone.</b><p>Join the list, then add your personal countdown and referral dashboard to your home screen.</p></div>
              <button className="button button-outline" type="button" onClick={() => setStep(1)}>Join &amp; get my countdown <span>↗</span></button>
            </aside>
            <p className="inline-note">Join early to see the real souvenirs you can earn. Every friend who joins through your personal link earns {siteContent.tokens_per_referral} tokens toward available rewards.</p>
            <div className="benefits">{[siteContent.benefit_one, siteContent.benefit_two, siteContent.benefit_three].map(benefit => <span key={benefit}>✦ {benefit}</span>)}</div>
          </div>
          <div className={`hero-art${siteContent.hero_image_url ? ' has-photo' : ''}`} role="img" aria-label={siteContent.hero_image_url ? siteContent.hero_image_alt : 'Online Bar early access'} style={siteContent.hero_image_url ? { backgroundImage: `url("${siteContent.hero_image_url.replaceAll('"', '%22')}")` } : undefined}><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="glass">✦</div><div className="art-label"><b>01</b><span>THE GOOD<br />STUFF IS NEAR</span></div><div className="art-note">FIRST IN.<br />FIRST POUR.</div></div>
          <footer className="hero-footer"><span>NAIROBI · KENYA</span><span>18+ · RESPONSIBLE ENJOYMENT</span><span>YOUR NEIGHBOURHOOD, NEXT</span></footer>
        </section>
      )}

      {ageGateComplete && step === 0 && siteRewards.length > 0 && (
        <section className="reward-preview" aria-label="Souvenirs you can earn">
          <div><p className="eyebrow"><span /> EARLY-ACCESS SOUVENIRS</p><h2>See what your tokens can get you.</h2><p className="muted">Every valid friend who joins with your invite earns {siteContent.tokens_per_referral} tokens. Save up to request an available souvenir; rewards are limited and confirmed by our team.</p></div>
          <div className="reward-grid">{siteRewards.map(reward => <article className="reward-card" key={reward.id}>{reward.image_url && <img src={reward.image_url} alt="" loading="lazy" />}<b>{reward.name}</b>{reward.description && <p>{reward.description}</p>}<span>{reward.token_cost} TOKENS TO REQUEST</span></article>)}</div>
        </section>
      )}

      {(step === 1 || step === 2) && (
        <section className="form-layout">
          <div className="form-aside"><p className="eyebrow"><span /> YOUR EARLY ACCESS</p><h1>{step === 1 ? 'First, your neighbourhood.' : 'Make it yours.'}</h1><p>We’re opening in selected areas first. Your area helps us plan where to go next.</p><div className="steps"><span className={step === 1 ? 'current' : 'complete'}>01</span><i /><span className={step === 2 ? 'current' : ''}>02</span><i /><span>03</span></div><small>LOCATION <b>·</b> YOUR DETAILS <b>·</b> YOU’RE IN</small></div>
          {step === 1 ? (
            <div className="form-card">
              <p className="eyebrow">STEP 01 — DELIVERY AREA</p><h2>Where should we deliver?</h2>              <p className="muted">Tell us your neighbourhood and a nearby landmark so we can plan where to launch next. GPS is optional.</p>
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
              <label>Nearby landmark <span className="optional">OPTIONAL</span><input value={landmark} onChange={event => setLandmark(event.target.value)} placeholder="e.g. Sarit Centre, Westlands" maxLength={120} /></label>
              <p className="privacy-note">We use your area to plan launch availability. Exact GPS coordinates are used only to find an approximate area and are not saved.</p>
              <button className="button button-primary full" disabled={busy || !resolvedArea || !resolvedCity || !location.county.trim()} onClick={() => setStep(2)}>Continue <span>→</span></button>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
          ) : (
            <form className="form-card" onSubmit={submit}>
              <p className="eyebrow">STEP 02 — YOUR INVITATION</p><h2>Where should we reach you?</h2>              <p className="muted">For {resolvedArea}, {location.city}. Already in our launch coverage? Join and wait for your launch update. Not there yet? Join anyway — we’re coming soon and your area helps us plan.</p>
              <label>Your name<input autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Name" maxLength={120} /></label>
              <label>Email address<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" maxLength={254} /></label>
              <label>Phone number <span className="optional">OPTIONAL UNLESS YOU CHOOSE SMS / WHATSAPP</span><input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value.replace(/\s/g, ''))} placeholder="+2547XXXXXXXX" maxLength={32} /></label>
              <p className="inline-note">Age range selected: {selectedAgeGroup?.label}. Your age range is used for launch planning and personalized music.</p>
              <fieldset className="reward-path-fieldset">
                <legend>What are you here for? <span className="optional">CHOOSE YOUR EXPERIENCE</span></legend>
                <div className="reward-path-grid">
                  {rewardPaths.map(path => (
                    <button
                      aria-pressed={rewardPath === path.id}
                      className={`reward-path-option${rewardPath === path.id ? ' selected' : ''}`}
                      key={path.id}
                      onClick={() => setRewardPath(path.id)}
                      type="button"
                    >
                      <span className="reward-path-icon" aria-hidden="true">{path.icon}</span>
                      <strong>{path.title}</strong>
                      <small>{path.description}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset><legend>How may we send your early-access update?</legend>
                {(['email', 'sms', 'whatsapp'] as const).map(channel => <label className="check-row" key={channel}><input type="checkbox" checked={consents[channel]} onChange={event => setConsents(current => ({ ...current, [channel]: event.target.checked }))} /><span>{channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp'} updates</span></label>)}
              </fieldset>
              {updatesAllowed && <label>Preferred contact method<select value={preferredContactMethod} onChange={event => setPreferredContactMethod(event.target.value as typeof preferredContactMethod)}><option value="">No preference</option>{consents.email && <option value="email">Email</option>}{consents.sms && <option value="sms">SMS</option>}{consents.whatsapp && <option value="whatsapp">WhatsApp</option>}</select></label>}
              <fieldset><legend>What would you love to see? <span className="optional">OPTIONAL · SELECT ANY</span></legend><div className="interest-grid">{interests.map(item => <button type="button" key={item} className={`interest ${selectedInterests.includes(item) ? 'selected' : ''}`} aria-pressed={selectedInterests.includes(item)} onClick={() => toggleInterest(item)}>{item}</button>)}</div></fieldset>
              <label>How often do you usually order? <span className="optional">OPTIONAL</span><select value={frequency} onChange={event => setFrequency(event.target.value)}><option value="">Choose one</option>{frequencies.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="check-row age-row"><input type="checkbox" required checked={ageConfirmed} onChange={event => setAgeConfirmed(event.target.checked)} /><span>I confirm that I am of legal drinking age. This is not a substitute for age checks when purchasing or receiving alcohol.</span></label>
              <label className="trap" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label>
              {savedMemberProfile && <p className="inline-note">Your saved details are filled in. You’re already registered, so use your dashboard instead of joining again unless you need to update this area.</p>}
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
          <p className="success-copy">{serviceAreaStatus === 'in_area'
            ? `Good news — ${resolvedArea}, ${resolvedCity} is in our current launch coverage. We’re getting ready to serve your area, so stay on the list and watch for your launch and early-access update.`
            : serviceAreaStatus === 'outside_area'
              ? `We’re not serving ${resolvedArea}, ${resolvedCity} just yet, but we’re coming soon. We’ve recorded your area${landmark.trim() ? ` near ${landmark.trim()}` : ''} to help us plan where to expand next, and we’ll keep you posted.`
              : `We’ve recorded demand for ${resolvedArea}, ${resolvedCity}${landmark.trim() ? ` near ${landmark.trim()}` : ''}. We’re still confirming launch coverage, and we’ll share an update as soon as we know more.`}</p>
          <p className="success-copy">You’re now on the Online Bar early-access list. Keep an eye on the contact channel(s) you selected for your update.</p>
          <aside className="halloween-invite halloween-invite-success" aria-label="Halloween party invitation opportunity">
            <span className="halloween-invite-icon" aria-hidden="true">✦</span>
            <div>
              <p className="halloween-invite-eyebrow">YOUR NEXT NIGHT OUT?</p>
              <h2>You could be invited.</h2>
              <p>You’re in the running for a special invitation to our Halloween-themed party. We’ll share the location and event details with invited guests in due time.</p>
            </div>
          </aside>
          {referralCode && <p className="referral">YOUR INVITE CODE <b>{referralCode}</b></p>}
          {rewardPath && <p className="inline-note">Your experience: {rewardPaths.find(path => path.id === rewardPath)?.title}</p>}
          <p className="success-copy">Your unique link tracks friends who join. Each successful new signup earns you {siteContent.tokens_per_referral} tokens to put toward the souvenirs shown on the site.</p>
          {referralCode && <div className="member-progress"><span>{memberProgress?.referralsJoined ?? '—'} FRIENDS JOINED</span><b>{memberProgress?.tokensAvailable ?? '—'} TOKENS READY</b></div>}
          {referralCode && <aside className="countdown-install-nudge">
            <p className="eyebrow"><span /> TAKE YOUR COUNTDOWN WITH YOU</p>
            <h2>Add your OB countdown to your home screen.</h2>
            <p>Open your personal dashboard and follow the steps to add it to your phone. Your countdown, joined-friend total and tokens will be one tap away.</p>
            <Link className="button button-primary" href={widgetUrl}>Add my countdown <span>↗</span></Link>
          </aside>}
          <button className="button button-primary" onClick={openShareChooser}>{shareLabel} <span>↗</span></button>
          {memberProgress?.error && <p className="inline-note" role="status">{memberProgress.error}</p>}
        </section>
      )}
      </>}
      {shareDialogOpen && (
        <div className="share-dialog-backdrop" onClick={() => setShareDialogOpen(false)}>
          <section
            aria-labelledby="share-dialog-title"
            aria-modal="true"
            className="share-dialog"
            onClick={event => event.stopPropagation()}
            role="dialog"
          >
            <button
              aria-label="Close sharing options"
              className="share-dialog-close"
              onClick={() => setShareDialogOpen(false)}
              ref={shareDialogCloseRef}
              type="button"
            >×</button>
            <p className="eyebrow"><span /> PASS THE GOOD TIMES ON</p>
            <h2 id="share-dialog-title">{shareLabel}</h2>
            <p className="share-dialog-copy">Choose where to send your personal invite. Your referral link stays attached.</p>
            <div className="share-platform-grid">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} rel="noreferrer" target="_blank">WhatsApp</a>
              <button onClick={() => void shareToApp('instagram')} type="button">Instagram</button>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`} rel="noreferrer" target="_blank">X</a>
              <button onClick={() => void shareToApp('snapchat')} type="button">Snapchat</button>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareLabel)}`} rel="noreferrer" target="_blank">Telegram</a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`} rel="noreferrer" target="_blank">Facebook</a>
              <a href={`mailto:?subject=${encodeURIComponent('Join me on Online Bar early access')}&body=${encodeURIComponent(shareMessage)}`}>Email</a>
              <a href={`sms:?body=${encodeURIComponent(shareMessage)}`}>Text message</a>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  className="share-platform-more"
                  onClick={async () => {
                    try {
                      await navigator.share({ title: 'Online Bar early access', text: shareMessage, url: shareLink });
                    } catch (cause) {
                      if (cause instanceof Error && cause.name !== 'AbortError') {
                        console.error('[WaitlistSite] Could not open the device share sheet:', cause);
                        setGpsStatus('Your device sharing menu could not be opened. Choose an app above or copy your invite.');
                      }
                    }
                  }}
                  type="button"
                >More apps…</button>
              )}
              <button className="share-platform-copy" onClick={() => void copyShareMessage()} type="button">Copy invite</button>
            </div>
            <p className="share-dialog-footnote">Instagram and Snapchat need you to paste the copied invite into your message or story. “More apps” opens sharing options supported by your phone.</p>
            {gpsStatus && <p className="inline-note" role="status">{gpsStatus}</p>}
          </section>
        </div>
      )}
      <aside className="support-cta">
        <div><p className="eyebrow"><span /> NEED A HAND?</p><p>Questions about early access? Message our support team on WhatsApp.</p></div>
        <a href="https://wa.me/254769345599?text=Hi%20Online%20Bar%2C%20I%20need%20support%20with%20the%20early-access%20waitlist." rel="noreferrer" target="_blank">WhatsApp support · 07 69345599 <span aria-hidden="true">↗</span></a>
      </aside>
      <footer className="site-footer"><span>ONLINE BAR</span><span>GOOD TIMES, DELIVERED.</span><a href="https://onlinebar.co.ke/privacy">PRIVACY</a></footer>
    </main>
  );
}
