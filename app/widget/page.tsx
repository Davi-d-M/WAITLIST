'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePwaInstall } from '../pwa-install-provider';

type Reward = { id: string; name: string; description: string; image_url: string | null; token_cost: number };
type Claim = { id: string; reward_id: string; tokens_spent: number; status: 'pending' | 'approved' | 'rejected'; created_at: string };
type Progress = { referralCode: string; ageGroup: string | null; referralsJoined: number; tokensEarned: number; tokensAvailable: number; claims: Claim[] };
type Content = { launch_at: string | null; tokens_per_referral: number };
const defaultContent: Content = { launch_at: null, tokens_per_referral: 10 };
function shareLabel(group: string | null) {
  if (group === '18_20' || group === '21_24') return 'Share the buzz';
  if (group === '25_34') return 'Tell a friend';
  return 'Whisper to a friend';
}

function countdown(target: string | null, now: number) {
  if (!target) return 'Launch date coming soon';
  const remaining = new Date(target).getTime() - now;
  if (!Number.isFinite(remaining)) return 'Launch date coming soon';
  if (remaining <= 0) return 'We are live';
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export default function WaitlistWidgetPage() {
  const [memberToken, setMemberToken] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [content, setContent] = useState<Content>(defaultContent);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [contentWarning, setContentWarning] = useState('');
  const [busyReward, setBusyReward] = useState('');
  const [loading, setLoading] = useState(true);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const { installPromptAvailable, isInstalled, install: promptInstall } = usePwaInstall();

  const refresh = useCallback(async (accessToken: string) => {
    const [memberResponse, contentResponse] = await Promise.all([
      fetch('/api/member', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('/api/content', { cache: 'no-store' })
    ]);
    const memberData = await memberResponse.json() as Progress & { error?: string };
    const contentData = await contentResponse.json() as { content?: Content; rewards?: Reward[]; error?: string };
    if (!memberResponse.ok) throw new Error(memberData.error || 'Your referral progress could not be loaded.');
    setProgress(memberData);
    if (!contentResponse.ok || !contentData.content) {
      console.error('[WaitlistWidget] Launch and souvenir content is unavailable:', contentData.error);
      setContent(defaultContent);
      setRewards([]);
      setContentWarning('Your referrals and tokens are available. Launch countdown and souvenirs are temporarily unavailable.');
      return;
    }
    setContent(contentData.content);
    setRewards(contentData.rewards || []);
    setContentWarning('');
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('waitlist-member-token') || '';
    setMemberToken(savedToken);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream);
    setIsAndroid(/Android/i.test(navigator.userAgent));
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(cause => {
        console.error('[WaitlistWidget] Could not register the home-screen dashboard:', cause);
      });
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    if (savedToken) {
      void refresh(savedToken)
        .catch(cause => setError(cause instanceof Error ? cause.message : 'Your dashboard could not be loaded.'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => {
      window.clearInterval(timer);
    };
  }, [refresh]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined' || !progress?.referralCode) return '';
    const url = new URL(`/invite/${encodeURIComponent(progress.referralCode)}`, window.location.origin);
    return url.toString();
  }, [progress?.referralCode]);

  const share = async () => {
    if (!shareUrl) return;
    setError('');
    setNotice('');
    setShareDialogOpen(true);
  };

  const shareMessage = useMemo(() => {
    const invitation = `Join me on the Online Bar early-access list. I earn ${content.tokens_per_referral} tokens when friends join through my link.`;
    return `${invitation} ${shareUrl}`;
  }, [content.tokens_per_referral, shareUrl]);

  const installDashboard = async () => {
    setError('');
    try {
      const outcome = await promptInstall();
      setNotice(outcome === 'accepted'
        ? 'Your dashboard is installed. Open it from your home screen or app list.'
        : 'Installation was cancelled. You can install it later from your browser menu.');
    } catch (cause) {
      console.error('[WaitlistWidget] Could not install the dashboard:', cause);
      setError('The install prompt is unavailable in this browser. Follow the steps below to add the dashboard.');
    }
  };

  const shareToApp = async (app: 'instagram' | 'tiktok' | 'snapchat') => {
    const appUrl = app === 'instagram'
      ? 'https://www.instagram.com/'
      : app === 'tiktok'
        ? 'https://www.tiktok.com/'
        : 'https://www.snapchat.com/';
    window.open(appUrl, '_blank', 'noopener,noreferrer');
    try {
      await navigator.clipboard.writeText(shareMessage);
      const destination = app === 'instagram' ? 'Instagram DM, story or bio' : app === 'tiktok' ? 'TikTok message, caption or bio' : 'Snapchat chat';
      setNotice(`Your invite is copied. Paste it into your ${destination} to share.`);
    } catch (cause) {
      console.error(`[WaitlistWidget] Could not copy the invite for ${app}:`, cause);
      setError(`Copy your invite link here, then paste it into ${app === 'instagram' ? 'Instagram' : app === 'tiktok' ? 'TikTok' : 'Snapchat'}.`);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setNotice('Your invite message and personal link are copied and ready to share.');
      setError('');
    } catch (cause) {
      console.error('[WaitlistWidget] Could not copy the invite message:', cause);
      setError('We could not copy the invite. Allow clipboard access or copy your personal invite link manually.');
    }
  };

  const shareWithDevice = async () => {
    try {
      await navigator.share({ title: 'Your Online Bar invite', text: shareMessage, url: shareUrl });
    } catch (cause) {
      if (cause instanceof Error && cause.name !== 'AbortError') {
        console.error('[WaitlistWidget] Could not open the device share sheet:', cause);
        setError('Your device sharing menu could not be opened. Choose an app above or copy your invite.');
      }
    }
  };

  const supportsNativeShare = typeof navigator !== 'undefined'
    && typeof Reflect.get(navigator, 'share') === 'function';

  const requestReward = async (reward: Reward) => {
    if (!progress || !memberToken) return;
    setBusyReward(reward.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberToken, rewardId: reward.id })
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || 'Your souvenir request could not be sent.');
      await refresh(memberToken);
      setNotice(`Your request for ${reward.name} was sent. Tokens are reserved while the team checks availability.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your souvenir request could not be sent.');
    } finally {
      setBusyReward('');
    }
  };

  if (loading) return <main className="widget-shell"><p className="eyebrow"><span /> ONLINE BAR DASHBOARD</p><h1>Loading your countdown…</h1></main>;
  if (!progress) return (
    <main className="widget-shell">
      <Link href="/" className="brand"><span className="brand-mark">OB</span> ONLINE BAR</Link>
      <p className="eyebrow"><span /> YOUR HOME-SCREEN DASHBOARD</p>
      <h1>{error ? 'Dashboard unavailable.' : 'Your invite link is missing.'}</h1>
      <p className="muted">{error || 'Join the waitlist first, then open this dashboard from your personal invite link to see your referrals and tokens.'}</p>
      <Link className="button button-primary" href="/">Join early access <span>↗</span></Link>
    </main>
  );

  return (
    <main className="widget-shell">
      <header className="widget-header"><Link className="brand" href="/"><span className="brand-mark">OB</span><span>ONLINE BAR<span className="brand-sub">YOUR EARLY-ACCESS DASHBOARD</span></span></Link><span className="top-status"><i /> 18+ · EARLY ACCESS</span></header>
      {!isInstalled && <section className="install-card" aria-label="Add your countdown dashboard to your home screen">
        <p className="eyebrow"><span /> KEEP YOUR COUNTDOWN CLOSE</p>
        <h2>Install your OB dashboard.</h2>
        <p>This adds a dashboard shortcut you can open for your live countdown, joined friends and tokens.</p>
        {installPromptAvailable
          ? <button className="button button-primary" type="button" onClick={() => void installDashboard()}>Install dashboard <span>↗</span></button>
          : <p className="install-instructions">{isIOS
            ? 'On iPhone or iPad: open this page in Safari, tap Share, choose “Add to Home Screen,” then tap “Add.”'
            : isAndroid
              ? 'On Android: open this page in Chrome, tap ⋮, choose “Install app” or “Add to Home screen,” then confirm.'
              : 'On Chrome: open ⋮ → “Cast, save, and share” → “Install page as app.” On Edge: open ⋯ → “Apps” → “Install this site as an app.” If neither option appears, open this page in Chrome or Edge.'}</p>}
      </section>}
      {contentWarning && <p className="error" role="status">{contentWarning}</p>}
      {isInstalled && <p className="inline-note" role="status">Your OB countdown dashboard is installed. Open it from your home screen any time.</p>}
      <section className="widget-countdown">
        <p className="eyebrow"><span /> THE LAUNCH IS GETTING CLOSER</p>
        <h1>{countdown(content.launch_at, now)}</h1>
        <p>Your countdown refreshes live while this dashboard is open.</p>
      </section>
      <section className="widget-stats" aria-label="Your referral progress">
        <article><span>FRIENDS WHO JOINED</span><b>{progress.referralsJoined}</b></article>
        <article><span>TOKENS EARNED</span><b>{progress.tokensEarned}</b></article>
        <article><span>TOKENS AVAILABLE</span><b>{progress.tokensAvailable}</b></article>
      </section>
      <div className="widget-actions">
        <button className="button button-primary" type="button" onClick={() => void share()}>{shareLabel(progress.ageGroup).toUpperCase()} <span>↗</span></button>
      </div>
      {notice && <p role="status" className="inline-note">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <section className="reward-preview widget-rewards">
        <div><p className="eyebrow"><span /> SOUVENIRS &amp; REWARDS</p><h2>Invite friends. Earn tokens. Request a reward.</h2><p className="muted">Each new person who joins through your link earns {content.tokens_per_referral} tokens. Requests are subject to prize availability and team confirmation.</p></div>
        {!rewards.length ? <p className="muted">The prize list is being prepared. Check back soon.</p> : <div className="reward-grid">{rewards.map(reward => {
          const pending = progress.claims.some(claim => claim.reward_id === reward.id && claim.status === 'pending');
          return <article className="reward-card" key={reward.id}>
            {reward.image_url && <img src={reward.image_url} alt="" loading="lazy" />}
            <b>{reward.name}</b>{reward.description && <p>{reward.description}</p>}
            <span>{reward.token_cost} TOKENS</span>
            <button type="button" className="button button-primary" disabled={busyReward !== '' || pending || progress.tokensAvailable < reward.token_cost} onClick={() => void requestReward(reward)}>
              {busyReward === reward.id ? 'Sending…' : pending ? 'Request pending' : progress.tokensAvailable < reward.token_cost ? 'Earn more tokens' : 'Request souvenir'}
            </button>
          </article>;
        })}</div>}
      </section>
      {!!progress.claims.length && <section className="widget-claims"><h2>Your souvenir requests</h2><ul>{progress.claims.map(claim => <li key={claim.id}><b>{rewards.find(reward => reward.id === claim.reward_id)?.name || 'Souvenir'}</b><span>{claim.tokens_spent} tokens · {claim.status}</span></li>)}</ul></section>}
      <aside className="support-cta">
        <div><p className="eyebrow"><span /> NEED A HAND?</p><p>Need help with your invite, tokens or rewards? Message our support team on WhatsApp.</p></div>
        <a href="https://wa.me/254769345599?text=Hi%20Online%20Bar%2C%20I%20need%20support%20with%20my%20early-access%20account." rel="noreferrer" target="_blank">WhatsApp support · 07 69345599 <span aria-hidden="true">↗</span></a>
      </aside>
      <footer className="site-footer"><Link href="/">ONLINE BAR</Link><span>YOUR INVITE CODE · {progress.referralCode}</span><span>GOOD TIMES, DELIVERED.</span></footer>
      {shareDialogOpen && <div className="share-dialog-backdrop" onClick={() => setShareDialogOpen(false)}>
        <section aria-labelledby="widget-share-title" aria-modal="true" className="share-dialog" onClick={event => event.stopPropagation()} role="dialog">
          <button aria-label="Close sharing options" className="share-dialog-close" onClick={() => setShareDialogOpen(false)} type="button">×</button>
          <p className="eyebrow"><span /> PASS THE GOOD TIMES ON</p>
          <h2 id="widget-share-title">{shareLabel(progress.ageGroup)}</h2>
          <p className="share-dialog-copy">Choose an app. Your personal invite link is included so friends who join can earn you {content.tokens_per_referral} tokens.</p>
          <div className="share-platform-grid">
            <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} rel="noreferrer" target="_blank">WhatsApp</a>
            <button onClick={() => void shareToApp('instagram')} type="button">Instagram</button>
            <button onClick={() => void shareToApp('tiktok')} type="button">TikTok</button>
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`} rel="noreferrer" target="_blank">X</a>
            <button onClick={() => void shareToApp('snapchat')} type="button">Snapchat</button>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareLabel(progress.ageGroup))}`} rel="noreferrer" target="_blank">Telegram</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} rel="noreferrer" target="_blank">Facebook</a>
            <a href={`mailto:?subject=${encodeURIComponent('Join me on Online Bar early access')}&body=${encodeURIComponent(shareMessage)}`}>Email</a>
            <a href={`sms:?body=${encodeURIComponent(shareMessage)}`}>Text message</a>
            {supportsNativeShare && <button className="share-platform-more" onClick={() => void shareWithDevice()} type="button">More apps on my phone…</button>}
            <button className="share-platform-copy" onClick={() => void copyInvite()} type="button">Copy invite</button>
          </div>
          <p className="share-dialog-footnote">Instagram, TikTok and Snapchat may ask you to paste your copied invite into a message, caption, story or bio. “More apps” opens the sharing options supported by your phone.</p>
          {notice && <p className="inline-note" role="status">{notice}</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      </div>}
    </main>
  );
}
