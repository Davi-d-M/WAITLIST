'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

const concepts = [
  ['character_cosplay', 'Character cosplay'],
  ['horror_halloween', 'Horror or Halloween look'],
  ['original_outfit', 'Creative original outfit'],
  ['group_duo', 'Group or duo costume'],
  ['undecided', 'Still deciding']
] as const;
const outfitStatuses = [
  ['fully_ready', "I've got the full fit ready"],
  ['idea_needs_help', 'I have the idea, but need help'],
  ['source_most', 'I need to find most of the outfit'],
  ['finishing_touches', 'I need finishing touches'],
  ['undecided', "I haven't decided yet"]
] as const;
const helpOptions = [
  ['finding_outfit', 'Finding the outfit'],
  ['styling', 'Styling and coordination'],
  ['makeup_sfx', 'Makeup or special effects'],
  ['wig_hair', 'Wig or hair styling'],
  ['props_accessories', 'Props and accessories'],
  ['tailoring', 'Tailoring or alterations'],
  ['costume_maker', 'Finding a costume maker'],
  ['inspiration_tutorials', 'Inspiration and tutorials']
] as const;
const budgetOptions = [
  ['under_2000', 'Under KSh 2,000'],
  ['kes_2000_5000', 'KSh 2,000–5,000'],
  ['kes_5000_10000', 'KSh 5,000–10,000'],
  ['above_10000', 'Above KSh 10,000'],
  ['need_ideas', 'Help me decide']
] as const;
const groupOptions = [
  ['solo', 'Solo'],
  ['partner', 'With a partner'],
  ['group', 'With a group'],
  ['find_group', 'Open to finding a group']
] as const;
const consentOptions = ['whatsapp', 'sms', 'email'] as const;

type FitSettings = { title: string; intro: string; merchant_notice: string };
type FitProfile = {
  concept: string;
  character_theme: string | null;
  outfit_status: string;
  budget_range: string | null;
  group_plan: string;
  fit_help_requests?: Array<{ service_key: string }>;
};
type FitOffering = {
  id: string; service_key: string; title: string; description: string;
  image_url: string | null; price_kes: number | null; updated_at: string;
};
type FitBooking = {
  id: string; offering_id: string; status: string; member_message: string;
  created_at: string; offering: { title: string; service_key: string; price_kes: number | null } | null;
};
type FitPayload = {
  profile: FitProfile | null;
  consent: { fitServiceUpdates: Record<string, boolean>; providerIntroduction: Record<string, boolean> };
  settings: FitSettings;
  offerings: FitOffering[];
  bookings: FitBooking[];
  error?: string;
};

const defaultSettings: FitSettings = {
  title: 'Midnight Fit Studio',
  intro: 'Tell us what you are planning and what help would make your Halloween look come together. This step is optional.',
  merchant_notice: 'We are listening to what you want and working with merchants to source the styles and services members ask for. Provider availability and prices must be confirmed; no match is guaranteed.'
};

export default function FitStudioForm() {
  const [token, setToken] = useState('');
  const [settings, setSettings] = useState(defaultSettings);
  const [concept, setConcept] = useState('horror_halloween');
  const [characterTheme, setCharacterTheme] = useState('');
  const [outfitStatus, setOutfitStatus] = useState('idea_needs_help');
  const [helpRequested, setHelpRequested] = useState<string[]>(helpOptions.map(([value]) => value));
  const [budgetRange, setBudgetRange] = useState('kes_2000_5000');
  const [groupPlan, setGroupPlan] = useState('solo');
  const [wantsUpdates, setWantsUpdates] = useState(false);
  const [consentChannels, setConsentChannels] = useState<string[]>([]);
  const [wantsProviderIntroduction, setWantsProviderIntroduction] = useState(false);
  const [providerChannels, setProviderChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offerings, setOfferings] = useState<FitOffering[]>([]);
  const [bookings, setBookings] = useState<FitBooking[]>([]);
  const [bookingMessage, setBookingMessage] = useState('');
  const [requestingBooking, setRequestingBooking] = useState('');

  const load = useCallback(async (memberToken: string) => {
    const response = await fetch('/api/fit-studio', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    const result = await response.json() as FitPayload;
    if (!response.ok) throw new Error(result.error || 'Fit Studio could not be loaded.');
    setSettings(result.settings);
    setOfferings(result.offerings || []);
    setBookings(result.bookings || []);
    const profile = result.profile;
    setHasProfile(Boolean(profile));
    if (profile) {
      setConcept(profile.concept);
      setCharacterTheme(profile.character_theme || '');
      setOutfitStatus(profile.outfit_status);
      setHelpRequested((profile.fit_help_requests || []).map(item => item.service_key));
      setBudgetRange(profile.budget_range || '');
      setGroupPlan(profile.group_plan);
    }
    const activeChannels = consentOptions.filter(channel => result.consent.fitServiceUpdates[channel] === true);
    setConsentChannels(activeChannels);
    setWantsUpdates(activeChannels.length > 0);
    const activeProviderChannels = consentOptions.filter(channel => result.consent.providerIntroduction[channel] === true);
    setProviderChannels(activeProviderChannels);
    setWantsProviderIntroduction(activeProviderChannels.length > 0);
    setReady(true);
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('waitlist-member-token') || '';
    setToken(savedToken);
    if (!savedToken) {
      setError('Your member pass is not available on this device. Reopen Fit Studio from your waitlist confirmation or restore your member pass first.');
      setLoading(false);
      return;
    }
    void load(savedToken)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Fit Studio could not be loaded.'))
      .finally(() => setLoading(false));
  }, [load]);

  const toggleOption = (values: string[], value: string, setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (wantsUpdates && consentChannels.length === 0) {
      setError('Choose at least one contact channel, or leave Fit Studio follow-up unchecked.');
      return;
    }
    if (wantsProviderIntroduction && providerChannels.length === 0) {
      setError('Choose a contact channel for provider introductions, or leave that permission unchecked.');
      return;
    }
    if (helpRequested.length === 0) {
      setError('Select at least one type of help so we know what to plan for.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/fit-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          concept, characterTheme, outfitStatus, helpRequested, budgetRange,
          groupPlan, wantsFitServiceUpdates: wantsUpdates, consentChannels,
          wantsProviderIntroduction, providerChannels
        })
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Your Fit Studio profile could not be saved.');
      setHasProfile(true);
      try {
        await load(token);
        setNotice('Your Fit Studio profile is saved. The team will review demand before confirming any provider or availability.');
      } catch {
        setNotice('Your Fit Studio profile was saved. Refresh to load offers matching your updated requests.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your Fit Studio profile could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const requestBooking = async (offeringId: string) => {
    setError('');
    setNotice('');
    setRequestingBooking(offeringId);
    try {
      const response = await fetch('/api/fit-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'request_booking', offeringId, message: bookingMessage })
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Your booking request could not be saved.');
      setBookingMessage('');
      try {
        await load(token);
        setNotice('Booking request sent. It is not confirmed until the team reviews availability and terms.');
      } catch {
        setNotice('Booking request sent, but its latest status could not be loaded. Refresh this page to check it.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your booking request could not be saved.');
    } finally {
      setRequestingBooking('');
    }
  };

  if (loading) return <section className="fit-studio-card" aria-live="polite"><p className="eyebrow">MIDNIGHT SOCIETY KE</p><h1>Loading Fit Studio…</h1></section>;
  if (!token || !ready) {
    return <section className="fit-studio-card"><p className="eyebrow">MIDNIGHT SOCIETY KE</p><h1>{error || 'Fit Studio is unavailable.'}</h1><p><a className="button button-primary" href="/">Return to your waitlist pass</a></p></section>;
  }

  return (
    <form className="fit-studio-card" onSubmit={save}>
      <p className="eyebrow"><span /> MIDNIGHT SOCIETY KE · OPTIONAL QUESTIONNAIRE</p>
      <h1>{settings.title}</h1>
      <p>{settings.intro}</p>
      <p className="fit-studio-notice">{settings.merchant_notice}</p>

      <fieldset>
        <legend>01 — What kind of look are you planning?</legend>
        <div className="fit-options">{concepts.map(([value, label]) => (
          <label className="fit-option" key={value}><input type="radio" name="concept" required checked={concept === value} onChange={() => setConcept(value)} /><span>{label}</span></label>
        ))}</div>
      </fieldset>

      <label className="form-card-label" htmlFor="fit-character-theme">02 — Character or theme <span className="optional">OPTIONAL</span></label>
      <input id="fit-character-theme" className="fit-text-input" maxLength={120} value={characterTheme} onChange={event => setCharacterTheme(event.target.value)} placeholder="e.g. gothic vampire, dark fantasy" />

      <fieldset>
        <legend>03 — How ready is your outfit?</legend>
        <div className="fit-options">{outfitStatuses.map(([value, label]) => (
          <label className="fit-option" key={value}><input type="radio" name="outfitStatus" required checked={outfitStatus === value} onChange={() => setOutfitStatus(value)} /><span>{label}</span></label>
        ))}</div>
      </fieldset>

      <fieldset>
        <legend>04 — What help would you like?</legend>
        <p className="muted">Choose all that apply. You can change this later.</p>
        <div className="fit-options">{helpOptions.map(([value, label]) => (
          <label className="fit-option" key={value}><input type="checkbox" checked={helpRequested.includes(value)} onChange={() => toggleOption(helpRequested, value, setHelpRequested)} /><span>{label}</span></label>
        ))}</div>
      </fieldset>

      <section className="fit-offers" aria-labelledby="fit-offers-title">
        <h2 id="fit-offers-title">Offers matching your requests</h2>
        <p>Published options for the help categories in your saved Fit Studio profile. Booking requests are not confirmed reservations or payments.</p>
        {!hasProfile
          ? <p className="fit-offers-empty">Save your Fit Studio profile first to see offers for your selected categories.</p>
          : offerings.length
            ? <div className="fit-offers-grid">
              {offerings.map(offer => {
                const booking = bookings.find(item => item.offering_id === offer.id);
                const imageUrl = offer.image_url?.replaceAll('"', '%22');
                return <article className="fit-offer-card" key={offer.id}>
                  {imageUrl && <div className="fit-offer-image" role="img" aria-label={offer.title + ' photo'} style={{ backgroundImage: 'url("' + imageUrl + '")' }} />}
                  <p className="eyebrow">{helpOptions.find(([key]) => key === offer.service_key)?.[1] || offer.service_key}</p>
                  <h3>{offer.title}</h3>
                  {offer.description && <p>{offer.description}</p>}
                  <b>{offer.price_kes === null ? 'Price on request' : 'KSh ' + new Intl.NumberFormat('en-KE').format(offer.price_kes)}</b>
                  {booking
                    ? <p className="fit-booking-status" role="status">Request status: {booking.status.replaceAll('_', ' ')}. The team will review availability and terms.</p>
                    : <button type="button" className="button button-primary" disabled={requestingBooking === offer.id} onClick={() => void requestBooking(offer.id)}>{requestingBooking === offer.id ? 'Sending request…' : 'Request to book'}</button>}
                </article>;
              })}
            </div>
            : <p className="fit-offers-empty">No published offers match your saved help categories yet. Check back later for new options.</p>}
        {hasProfile && offerings.length > 0 && <label className="form-card-label" htmlFor="fit-booking-message">Optional note to the team
          <textarea id="fit-booking-message" className="fit-text-input" maxLength={500} value={bookingMessage} onChange={event => setBookingMessage(event.target.value)} placeholder="Add a detail for your booking request" />
        </label>}
        {bookings.length > 0 && <div className="fit-booking-list"><h3>Your booking requests</h3>{bookings.map(booking => <p key={booking.id}><b>{booking.offering?.title || 'Fit Studio offer'}</b> · {booking.status.replaceAll('_', ' ')}</p>)}</div>}
      </section>

      <fieldset>
        <legend>05 — What is your budget? <span className="optional">OPTIONAL</span></legend>
        <div className="fit-options">{budgetOptions.map(([value, label]) => (
          <label className="fit-option" key={value}><input type="radio" name="budget" checked={budgetRange === value} onChange={() => setBudgetRange(value)} /><span>{label}</span></label>
        ))}<label className="fit-option"><input type="radio" name="budget" checked={!budgetRange} onChange={() => setBudgetRange('')} /><span>Prefer not to say</span></label></div>
      </fieldset>

      <fieldset>
        <legend>06 — Who are you planning with?</legend>
        <div className="fit-options">{groupOptions.map(([value, label]) => (
          <label className="fit-option" key={value}><input type="radio" name="groupPlan" required checked={groupPlan === value} onChange={() => setGroupPlan(value)} /><span>{label}</span></label>
        ))}</div>
      </fieldset>

      <fieldset className="fit-consent">
        <legend>Optional Fit Studio follow-up</legend>
        <label className="fit-option"><input type="checkbox" checked={wantsUpdates} onChange={event => setWantsUpdates(event.target.checked)} /><span>I want relevant costume resources and styling updates. I can withdraw consent later.</span></label>
        <p className="muted">Choose each channel you consent to. This is separate from waitlist messages and general event marketing.</p>
        <div className="fit-options">{consentOptions.map(channel => (
          <label className="fit-option" key={channel}><input type="checkbox" disabled={!wantsUpdates} checked={consentChannels.includes(channel)} onChange={() => toggleOption(consentChannels, channel, setConsentChannels)} /><span>{channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()}</span></label>
        ))}</div>
      </fieldset>

      <fieldset className="fit-consent">
        <legend>Optional provider introduction permission</legend>
        <label className="fit-option"><input type="checkbox" checked={wantsProviderIntroduction} onChange={event => setWantsProviderIntroduction(event.target.checked)} /><span>If a suitable provider is available, ONLINE BAR may share my name and the contact channel(s) I select to introduce us.</span></label>
        <p className="muted">This permission is separate from updates. No provider receives your details unless an introduction is arranged. You can withdraw this permission by editing your profile and unchecking it.</p>
        <div className="fit-options">{consentOptions.map(channel => (
          <label className="fit-option" key={channel}><input type="checkbox" disabled={!wantsProviderIntroduction} checked={providerChannels.includes(channel)} onChange={() => toggleOption(providerChannels, channel, setProviderChannels)} /><span>{channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()}</span></label>
        ))}</div>
      </fieldset>

      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="inline-note" role="status" aria-live="polite">{notice}</p>}
      <div className="fit-studio-actions">
        <a className="button button-outline" href="/widget">Return to my member pass</a>
        <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save my fit profile'} <span>↗</span></button>
      </div>
      <p className="privacy-note">Your answers help us plan demand. Your contact details are not shared with a merchant or provider just because you complete this form. Provider availability, prices and introductions must be confirmed separately.</p>
    </form>
  );
}
