import { RefreshCw } from 'lucide-react';
import { useAppRelease } from '../features/version/useAppRelease';
import { useLanguage } from '../context/LanguageContext';
import './AppUpdateNotice.css';

export default function AppUpdateNotice() {
  const { latest, refresh, updating, status } = useAppRelease();
  const { language } = useLanguage();
  if (!latest) return null;
  const sq = language === 'sq';
  return <aside className="app-update-notice" role="status" aria-live="polite">
    <div><strong>{sq ? 'Përditësim i disponueshëm' : 'Update available'} · v{latest.version}</strong><p>{status === 'save-error' ? (sq ? 'Nuk mund të konfirmojmë ruajtjen në cloud. Kontrolloni lidhjen dhe provoni përsëri.' : 'Cloud saves could not be confirmed. Check your connection and try again.') : (sq ? 'Rifreskoni për të marrë përmirësimet e fundit.' : 'Refresh to get the latest improvements.')}</p></div>
    <button type="button" className="btn-primary" disabled={updating} onClick={refresh}><RefreshCw size={16} className={updating ? 'animate-spin' : ''} />{updating ? (sq ? 'Duke ruajtur…' : 'Saving…') : (sq ? 'Përditëso tani' : 'Update now')}</button>
  </aside>;
}

export function AppVersionStatus() {
  const { version, buildDate, latest, check, status } = useAppRelease();
  const { language } = useLanguage();
  const sq = language === 'sq';
  return <div className="app-version-status"><strong>Noesis Horizon · v{version}</strong><span>{buildDate}</span><button type="button" className="btn-secondary" disabled={status === 'checking'} onClick={() => check(true)}>{status === 'checking' ? (sq ? 'Duke kontrolluar…' : 'Checking…') : (sq ? 'Kontrollo për përditësime' : 'Check for updates')}</button>{status !== 'idle' && <p role="status">{latest ? `${sq ? 'I disponueshëm' : 'Available'}: v${latest.version}` : status === 'checked' ? (sq ? 'Keni versionin më të fundit.' : 'You are up to date.') : status === 'offline' ? (sq ? 'Nuk ka lidhje interneti.' : 'You are offline.') : status === 'error' ? (sq ? 'Kontrolli dështoi. Provoni përsëri.' : 'Could not check. Please try again.') : ''}</p>}</div>;
}
