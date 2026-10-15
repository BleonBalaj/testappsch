import { createElement, useEffect, useState } from 'react';
import { Moon, Sun, Laptop, Leaf, Pause, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { applyTheme } from '../../features/theme/themeStore';
import { useThemeMode } from '../../features/theme/useThemeMode';
import {
  NATURE_PHASE_EVENT, NATURE_SEASON_EVENT, NATURE_MOTION_EVENT,
  readNaturePhasePref, readNatureSeason, readNatureMotionPaused,
  writeNaturePhasePref, writeNatureSeason, writeNatureMotionPaused,
} from '../../features/theme/nature-phase';

export default function ThemePicker({ compact = false }) {
  const { currentUser, updateGlobalPreferences } = useAuth();
  const { language } = useLanguage();
  const mode = useThemeMode();
  const sq = language === 'sq';
  const [error, setError] = useState('');
  const choose = async value => {
    applyTheme(value);
    setError('');
    if (currentUser?.uid) {
      try { await updateGlobalPreferences({ theme: value }); }
      catch { setError(sq ? 'Tema u ndryshua në këtë pajisje, por sinkronizimi dështoi. Provoni përsëri.' : 'Theme changed on this device, but cloud sync failed. Please try again.'); }
    }
  };
  const options = [
    ['dark', Moon, sq ? 'Errët' : 'Dark'], ['light', Sun, sq ? 'Çelët' : 'Light'],
    ['system', Laptop, sq ? 'Sistemi' : 'System'], ['nature', Leaf, 'Nature'],
  ];
  return <div className={`app-theme-picker ${compact ? 'is-compact' : ''}`}>
    <div className="app-theme-options" role="group" aria-label={sq ? 'Tema e ndërfaqes' : 'Interface theme'}>
      {options.map(([value, Icon, label]) => <button type="button" key={value} className={`app-theme-choice ${mode === value ? 'active' : ''}`} aria-pressed={mode === value} onClick={() => choose(value)}>{createElement(Icon, { size: 16 })}<span>{label}</span></button>)}
    </div>
    {mode === 'nature' && <NatureControls compact={compact} sq={sq} />}
    {error && <p className="theme-sync-error" role="alert">{error}</p>}
  </div>;
}

function NatureControls({ compact, sq }) {
  const { currentUser, updateGlobalPreferences } = useAuth();
  const read = () => ({ phase: readNaturePhasePref(), season: readNatureSeason(), paused: readNatureMotionPaused() });
  const [preferences, setPreferences] = useState(read);
  const [error, setError] = useState('');
  useEffect(() => {
    const sync = () => setPreferences(read());
    const events = [NATURE_PHASE_EVENT, NATURE_SEASON_EVENT, NATURE_MOTION_EVENT, 'storage'];
    events.forEach(event => window.addEventListener(event, sync));
    return () => events.forEach(event => window.removeEventListener(event, sync));
  }, []);
  const choose = async (key, value) => {
    if (key === 'phase') writeNaturePhasePref(value);
    else writeNatureSeason(value);
    setError('');
    if (currentUser?.uid) {
      try { await updateGlobalPreferences({ nature: { phase: readNaturePhasePref(), season: readNatureSeason() } }); }
      catch { setError(sq ? 'Pamja ndryshoi, por sinkronizimi me llogarinë dështoi.' : 'View changed, but syncing it to your account failed.'); }
    }
  };
  const seasons = [['auto', sq ? 'Auto' : 'Auto'], ['summer', sq ? 'Verë' : 'Summer'], ['autumn', sq ? 'Vjeshtë' : 'Autumn'], ['winter', sq ? 'Dimër' : 'Winter']];
  const phases = [['auto', 'Auto'], ['morning', sq ? 'Mëngjes' : 'Morning'], ['golden', sq ? 'Perëndim' : 'Golden'], ['night', sq ? 'Natë' : 'Night']];
  const group = (key, label, values) => <div className="nature-option-section"><span className="nature-option-label">{label}</span><div className="nature-option-pill" role="group" aria-label={label}>{values.map(([value, text]) => <button key={value} type="button" aria-pressed={preferences[key] === value} className={preferences[key] === value ? 'active' : ''} onClick={() => choose(key, value)}>{text}</button>)}</div></div>;
  return <div className={`nature-controls ${compact ? 'is-compact' : ''}`} data-login-nature-controls={compact ? '' : undefined}>
    <div className="nature-controls-options">
      {group('season', sq ? 'Stina' : 'Season', seasons)}
      {group('phase', sq ? 'Koha e ditës' : 'Time of day', phases)}
      <button type="button" className="nature-pause-button" aria-pressed={preferences.paused} aria-label={preferences.paused ? (sq ? 'Vazhdo lëvizjen e sfondit' : 'Resume background movement') : (sq ? 'Ndalo lëvizjen e sfondit' : 'Pause background movement')} onClick={() => writeNatureMotionPaused(!preferences.paused)} title={sq ? 'Lëvizja e sfondit' : 'Background movement'}>{preferences.paused ? <Play size={16} /> : <Pause size={16} />}{!compact && <span>{preferences.paused ? (sq ? 'Vazhdo lëvizjen' : 'Resume movement') : (sq ? 'Ndalo lëvizjen' : 'Pause movement')}</span>}</button>
    </div>
    {!compact && <p className="nature-settings-hint">{sq ? 'Auto ndjek datën dhe orën lokale: vjeshtë shtator–nëntor, dimër dhjetor–shkurt, livadh pranveror/veror mars–gusht. Ndalimi i lëvizjes ruhet vetëm në këtë pajisje; stina dhe koha ruhen në llogarinë tuaj.' : 'Auto follows your local date and clock: Autumn September–November, Winter December–February, and the spring/summer meadow March–August. Movement pause is saved on this device; season and time of day sync with your account.'}</p>}
    {error && <p className="theme-sync-error" role="alert">{error}</p>}
  </div>;
}
