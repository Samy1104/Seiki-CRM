import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LayoutGrid, LogOut, Copy, Check, Sparkles, Loader2, Link2, Image as ImageIcon, X, RotateCcw, GraduationCap, AtSign, Trash2 } from 'lucide-react';
import { contentService, type ContentVoice, type ContentLanguage, type LinkedInPost, type TagEntry } from '../services/contentService';
import { linkedinService, type LinkedinAccount, type ScheduledPost } from '../services/linkedinService';
import { Prospection } from './Prospection';

type MentionField = 'hook' | 'corps';

interface ContenuProps {
  setActiveApp: (app: 'portal' | 'crm' | 'contenu') => void;
}

const panelStyle: React.CSSProperties = { background: 'var(--bg-panel)', borderColor: 'var(--border-subtle)' };
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
};

export const Contenu: React.FC<ContenuProps> = ({ setActiveApp }) => {
  const { logout } = useAuth();
  const { showToast } = useToast();

  const [contenuView, setContenuView] = useState<'linkedin' | 'prospection'>('linkedin');

  const [brief, setBrief] = useState('');
  const [voice, setVoice] = useState<ContentVoice>('seiki');
  const [language, setLanguage] = useState<ContentLanguage>('fr');
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<LinkedInPost | null>(null);
  const [originalPost, setOriginalPost] = useState<LinkedInPost | null>(null);
  const [copied, setCopied] = useState(false);
  const [learning, setLearning] = useState(false);

  const [accounts, setAccounts] = useState<LinkedinAccount[]>([]);
  const [queue, setQueue] = useState<ScheduledPost[]>([]);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const [tagBook, setTagBook] = useState<TagEntry[]>([]);
  const [newTagAlias, setNewTagAlias] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagUrn, setNewTagUrn] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [mention, setMention] = useState<{ field: MentionField; query: string } | null>(null);

  const hookRef = useRef<HTMLTextAreaElement>(null);
  const corpsRef = useRef<HTMLTextAreaElement>(null);
  const fieldRefs: Record<MentionField, React.RefObject<HTMLTextAreaElement | null>> = { hook: hookRef, corps: corpsRef };

  const loadAccounts = () => linkedinService.listAccounts().then(setAccounts).catch(() => {});
  const loadQueue = () => linkedinService.listScheduledPosts().then(setQueue).catch(() => {});
  const loadTagBook = () => contentService.getTagBook().then(setTagBook).catch(() => {});

  useEffect(() => {
    loadAccounts();
    loadQueue();
    loadTagBook();

    const params = new URLSearchParams(window.location.search);
    const linkedinStatus = params.get('linkedin');
    if (linkedinStatus === 'connected') {
      showToast(`Compte LinkedIn "${params.get('label')}" connecté.`, 'success');
      loadAccounts();
    } else if (linkedinStatus === 'error') {
      showToast(params.get('message') || 'Connexion LinkedIn échouée.', 'error');
    }
    if (linkedinStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    if (!brief.trim()) {
      showToast('Décris le sujet du post avant de générer.', 'error');
      return;
    }
    setLoading(true);
    setCopied(false);
    try {
      const result = await contentService.generateLinkedInPost(brief, voice, language);
      setPost(result);
      setOriginalPost(result);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la génération', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fullText = post
    ? `${post.hook}\n\n${post.corps}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const postsAreEqual = (a: LinkedInPost, b: LinkedInPost) =>
    a.hook === b.hook && a.corps === b.corps && a.hashtags.join(' ') === b.hashtags.join(' ');

  const handleLearn = async () => {
    if (!post || !originalPost) return;
    if (postsAreEqual(post, originalPost)) {
      showToast('Aucune modification à apprendre.', 'info');
      return;
    }
    setLearning(true);
    try {
      await contentService.learnFromEdit(voice, originalPost, post);
      setOriginalPost(post);
      showToast('Style mis à jour à partir de tes corrections.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de l'apprentissage", 'error');
    } finally {
      setLearning(false);
    }
  };

  const detectMention = (field: MentionField, value: string, cursor: number) => {
    const uptoCursor = value.slice(0, cursor);
    const match = uptoCursor.match(/@([a-zA-Z0-9_-]*)$/);
    setMention(match ? { field, query: match[1] } : null);
  };

  const handleFieldChange = (field: MentionField, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!post) return;
    const value = e.target.value;
    setPost({ ...post, [field]: value });
    detectMention(field, value, e.target.selectionStart ?? value.length);
  };

  const insertMention = (tag: TagEntry) => {
    if (!post || !mention) return;
    const field = mention.field;
    const el = fieldRefs[field].current;
    const value = post[field];
    const cursor = el?.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = uptoCursor.match(/@([a-zA-Z0-9_-]*)$/);
    const start = match ? cursor - match[0].length : cursor;
    const mentionText = `@[${tag.name}](${tag.urn})`;
    const newValue = value.slice(0, start) + mentionText + ' ' + value.slice(cursor);
    setPost({ ...post, [field]: newValue });
    setMention(null);
    requestAnimationFrame(() => {
      const newCursor = start + mentionText.length + 1;
      el?.focus();
      el?.setSelectionRange(newCursor, newCursor);
    });
  };

  const mentionMatches = mention
    ? tagBook
        .filter(
          (t) =>
            t.alias.toLowerCase().includes(mention.query.toLowerCase()) ||
            t.name.toLowerCase().includes(mention.query.toLowerCase())
        )
        .slice(0, 6)
    : [];

  const handleAddTag = async () => {
    if (!newTagAlias.trim() || !newTagName.trim() || !newTagUrn.trim()) {
      showToast('Alias, nom et URN sont requis.', 'error');
      return;
    }
    if (!/^urn:li:(organization|person):.+/.test(newTagUrn.trim())) {
      showToast('URN invalide (doit commencer par urn:li:organization: ou urn:li:person:).', 'error');
      return;
    }
    if (tagBook.some((t) => t.alias.toLowerCase() === newTagAlias.trim().toLowerCase())) {
      showToast('Cet alias existe déjà.', 'error');
      return;
    }
    setSavingTag(true);
    try {
      const updated = [...tagBook, { alias: newTagAlias.trim(), name: newTagName.trim(), urn: newTagUrn.trim() }];
      await contentService.saveTagBook(updated);
      setTagBook(updated);
      setNewTagAlias('');
      setNewTagName('');
      setNewTagUrn('');
      showToast('Compte ajouté.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de l'ajout", 'error');
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (alias: string) => {
    const updated = tagBook.filter((t) => t.alias !== alias);
    try {
      await contentService.saveTagBook(updated);
      setTagBook(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la suppression', 'error');
    }
  };

  const handleSchedule = async () => {
    if (!post) return;
    if (!targetAccountId) {
      showToast('Choisis un compte LinkedIn connecté.', 'error');
      return;
    }
    if (!scheduledAt) {
      showToast('Choisis une date et une heure.', 'error');
      return;
    }
    setScheduling(true);
    try {
      let imagePath: string | null = null;
      if (imageFile) {
        imagePath = await linkedinService.uploadImage(imageFile);
      }
      await linkedinService.schedulePost({
        hook: post.hook,
        corps: post.corps,
        hashtags: post.hashtags,
        imagePath,
        targetAccountId,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      showToast('Post programmé.', 'success');
      setPost(null);
      setOriginalPost(null);
      setBrief('');
      setImageFile(null);
      setScheduledAt('');
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la programmation', 'error');
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await linkedinService.cancelScheduledPost(id);
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de l'annulation", 'error');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await linkedinService.retryScheduledPost(id);
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la relance', 'error');
    }
  };

  const accountLabel = (id: string) => accounts.find((a) => a.id === id)?.label ?? 'Compte supprimé';

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark-wrap">
            <img src="/grand_logo.png" alt="Seiki" className="logo-mark" />
          </div>
          <div className="logo-sub">CONTENU — IA PREDICtive</div>
        </div>

        <nav className="nav">
          <button
            className={`nav-item${contenuView === 'linkedin' ? ' on' : ''}`}
            onClick={() => setContenuView('linkedin')}
          >
            <LayoutGrid size={16} />
            <span>Générateur LinkedIn</span>
          </button>
          <button
            className={`nav-item${contenuView === 'prospection' ? ' on' : ''} nav-item-ai`}
            onClick={() => setContenuView('prospection')}
          >
            <Sparkles size={16} />
            <span>Prospection IA</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" style={{ marginBottom: '8px' }} onClick={() => setActiveApp('portal')}>
            <LayoutGrid size={14} style={{ marginRight: '6px' }} />
            Retour Portail
          </button>

          <button className="btn-logout" onClick={logout}>
            <LogOut size={14} style={{ marginRight: '6px' }} />
            Déconnexion
          </button>

          <div className="powered-by-seiki-footer">
            <span className="powered-text">Powered by</span>
            <img src="/seiki_logo_large.png" className="seiki-footer-logo" alt="Seiki Logo" />
            <span className="seiki-footer-name">Seiki</span>
          </div>
        </div>
      </aside>

      {contenuView === 'prospection' ? (
        <main className="main-content">
          <Prospection />
        </main>
      ) : (
      <main className="main-content p-8" style={{ overflowY: 'auto' }}>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-heading)' }}>
              Générateur de posts LinkedIn
            </h1>
            <p className="text-[var(--text-secondary)] mt-1">
              Décris le sujet, choisis la voix et la langue — l'agent écrit dans le style Seiki.
            </p>
          </div>

          <div className="space-y-4 p-6 rounded-2xl border" style={panelStyle}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-sm text-[var(--text-secondary)]">Comptes LinkedIn connectés</label>
              <div className="flex gap-2">
                <a href={linkedinService.oauthConnectUrl('personal', 'Jaafar')} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <Link2 size={14} />
                  {accounts.some((a) => a.target_type === 'personal') ? 'Reconnecter Jaafar' : 'Connecter Jaafar'}
                </a>
                <a href={linkedinService.oauthConnectUrl('company', 'Seiki')} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <Link2 size={14} />
                  {accounts.some((a) => a.target_type === 'company') ? 'Reconnecter Seiki' : 'Connecter Seiki'}
                </a>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-[var(--text-secondary)]">Brief</label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Ex : Nous venons de signer un partenariat avec la ville de Lyon pour mesurer les flux piétons du centre-ville..."
                rows={5}
                className="w-full rounded-lg p-3 text-sm"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Voix</label>
                <select value={voice} onChange={(e) => setVoice(e.target.value as ContentVoice)} className="rounded-lg p-2 text-sm" style={inputStyle}>
                  <option value="seiki">Seiki (entreprise)</option>
                  <option value="jaafar">Jaafar (personnel)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2 text-[var(--text-secondary)]">Langue</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value as ContentLanguage)} className="rounded-lg p-2 text-sm" style={inputStyle}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="nav-item on"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto',
                padding: '10px 24px', borderRadius: 'var(--radius-btn)', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Loader2 size={14} style={{ marginRight: '8px' }} className="animate-spin" /> : <Sparkles size={14} style={{ marginRight: '8px' }} />}
              {loading ? 'Génération...' : 'Générer le post'}
            </button>
          </div>

          <div className="space-y-3 p-6 rounded-2xl border" style={panelStyle}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <AtSign size={16} /> Comptes tagués
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Ajoute un alias une fois (nom + URN LinkedIn), puis tape @alias dans le post pour l'insérer. Pour trouver l'URN : si tu administres la page, le numéro est dans l'URL d'admin
              (linkedin.com/company/&lt;ID&gt;/admin/) → urn:li:organization:&lt;ID&gt;. Sinon, ouvre la page publique et cherche "urn:li:organization:" dans le code source (Ctrl+U).
            </p>

            {tagBook.length > 0 && (
              <div className="space-y-2">
                {tagBook.map((t) => (
                  <div key={t.alias} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="min-w-0 flex items-center gap-2 text-sm">
                      <span style={{ color: 'var(--gold)' }}>@{t.alias}</span>
                      <span className="text-[var(--text-primary)] truncate">{t.name}</span>
                      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{t.urn}</span>
                    </div>
                    <button onClick={() => handleDeleteTag(t.alias)} className="shrink-0" style={{ color: 'var(--text-secondary)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Alias</label>
                <input value={newTagAlias} onChange={(e) => setNewTagAlias(e.target.value)} placeholder="Lyon" className="rounded-lg p-2 text-sm" style={{ ...inputStyle, width: '110px' }} />
              </div>
              <div>
                <label className="block text-xs mb-1 text-[var(--text-secondary)]">Nom affiché</label>
                <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Ville de Lyon" className="rounded-lg p-2 text-sm" style={{ ...inputStyle, width: '180px' }} />
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs mb-1 text-[var(--text-secondary)]">URN LinkedIn</label>
                <input value={newTagUrn} onChange={(e) => setNewTagUrn(e.target.value)} placeholder="urn:li:organization:12345" className="w-full rounded-lg p-2 text-sm" style={inputStyle} />
              </div>
              <button
                onClick={handleAddTag}
                disabled={savingTag}
                className="nav-item on"
                style={{ display: 'inline-flex', alignItems: 'center', width: 'auto', padding: '10px 16px', borderRadius: 'var(--radius-btn)', cursor: savingTag ? 'default' : 'pointer', opacity: savingTag ? 0.7 : 1 }}
              >
                {savingTag ? <Loader2 size={14} className="animate-spin" /> : 'Ajouter'}
              </button>
            </div>
          </div>

          {post && (
            <div className="p-6 rounded-2xl border space-y-4" style={panelStyle}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Aperçu (éditable)</h2>
                <div className="flex gap-4">
                  <button
                    onClick={handleLearn}
                    disabled={learning}
                    className="text-sm flex items-center gap-1"
                    style={{ color: 'var(--text-secondary)', opacity: learning ? 0.6 : 1 }}
                    title="Enregistre tes corrections pour améliorer les prochaines générations dans cette voix"
                  >
                    {learning ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
                    Valider et enregistrer
                  </button>
                  <button onClick={handleCopy} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    {copied ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  ref={hookRef}
                  value={post.hook}
                  onChange={(e) => handleFieldChange('hook', e)}
                  onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'hook' ? null : m)), 150)}
                  rows={2}
                  className="w-full rounded-lg p-3 text-sm"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
                {mention?.field === 'hook' && mentionMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border overflow-hidden" style={panelStyle}>
                    {mentionMatches.map((t) => (
                      <button
                        key={t.alias}
                        onClick={() => insertMention(t)}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <AtSign size={12} style={{ color: 'var(--text-secondary)' }} />
                        <span>{t.alias}</span>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <textarea
                  ref={corpsRef}
                  value={post.corps}
                  onChange={(e) => handleFieldChange('corps', e)}
                  onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'corps' ? null : m)), 150)}
                  rows={8}
                  className="w-full rounded-lg p-3 text-sm"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
                {mention?.field === 'corps' && mentionMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border overflow-hidden" style={panelStyle}>
                    {mentionMatches.map((t) => (
                      <button
                        key={t.alias}
                        onClick={() => insertMention(t)}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <AtSign size={12} style={{ color: 'var(--text-secondary)' }} />
                        <span>{t.alias}</span>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                value={post.hashtags.join(' ')}
                onChange={(e) => setPost({ ...post, hashtags: e.target.value.split(/\s+/).filter(Boolean).map((h) => h.replace(/^#/, '')) })}
                className="w-full rounded-lg p-3 text-sm"
                style={inputStyle}
                placeholder="#hashtag1 #hashtag2"
              />

              <div className="flex gap-4 flex-wrap items-end">
                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)]">Compte cible</label>
                  <select value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} className="rounded-lg p-2 text-sm" style={inputStyle}>
                    <option value="">— Choisir —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)]">Date et heure</label>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="rounded-lg p-2 text-sm" style={inputStyle} />
                </div>

                <div>
                  <label className="block text-sm mb-2 text-[var(--text-secondary)] flex items-center gap-1">
                    <ImageIcon size={14} /> Image (optionnel)
                  </label>
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" style={{ color: 'var(--text-secondary)' }} />
                </div>

                <button
                  onClick={handleSchedule}
                  disabled={scheduling}
                  className="nav-item on"
                  style={{ display: 'inline-flex', alignItems: 'center', width: 'auto', padding: '10px 20px', borderRadius: 'var(--radius-btn)', cursor: scheduling ? 'default' : 'pointer', opacity: scheduling ? 0.7 : 1 }}
                >
                  {scheduling ? <Loader2 size={14} style={{ marginRight: '8px' }} className="animate-spin" /> : null}
                  Programmer
                </button>
              </div>
            </div>
          )}

          <div className="p-6 rounded-2xl border space-y-3" style={panelStyle}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Posts programmés</h2>
            {queue.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Aucun post programmé.</p>}
            {queue.map((p) => (
              <div key={p.id} className="p-3 rounded-lg flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate">{p.hook}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {accountLabel(p.target_account_id)} · {new Date(p.scheduled_at).toLocaleString('fr-FR')} ·{' '}
                    <span style={{ color: p.status === 'failed' ? 'var(--red, #e55)' : p.status === 'posted' ? 'var(--green)' : 'var(--text-secondary)' }}>
                      {p.status}
                    </span>
                    {p.status === 'failed' && p.error_message && ` — ${p.error_message}`}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {p.status === 'failed' && (
                    <button onClick={() => handleRetry(p.id)} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <RotateCcw size={14} /> Relancer
                    </button>
                  )}
                  {p.status === 'scheduled' && (
                    <button onClick={() => handleCancel(p.id)} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <X size={14} /> Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      )}
    </div>
  );
};
