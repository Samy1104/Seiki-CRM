import React, { useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { useLinkedInContent } from '../hooks/useLinkedInContent';
import { useLinkedInAccounts } from '../hooks/useLinkedInAccounts';
import { useTagBook } from '../hooks/useTagBook';
import { ContenuHeader } from './contenu/ContenuHeader';
import { PostGeneratorForm } from './contenu/PostGeneratorForm';
import { PostEditorPreview } from './contenu/PostEditorPreview';
import { PostSchedulerPanel } from './contenu/PostSchedulerPanel';
import { TagBookPanel } from './contenu/TagBookPanel';

interface ContenuProps {
  setActiveApp?: (app: 'portal' | 'crm' | 'contenu') => void;
  setView?: (view: string) => void;
}

export const Contenu: React.FC<ContenuProps> = () => {
  const { showToast } = useToast();

  const {
    brief,
    setBrief,
    voice,
    setVoice,
    language,
    setLanguage,
    loading,
    post,
    setPost,
    originalPost,
    copied,
    learning,
    handleGenerate,
    handleCopy,
    handleLearn,
  } = useLinkedInContent();

  const {
    accounts,
    queue,
    targetAccountId,
    setTargetAccountId,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    setImageFile,
    scheduling,
    loadAccounts,
    loadQueue,
    handleSchedule,
    handleCancel,
    handleRetry,
  } = useLinkedInAccounts();

  const {
    tagBook,
    newTagAlias,
    setNewTagAlias,
    newTagName,
    setNewTagName,
    newTagUrn,
    setNewTagUrn,
    savingTag,
    mention,
    setMention,
    mentionMatches,
    loadTagBook,
    detectMention,
    insertMention,
    handleAddTag,
    handleDeleteTag,
  } = useTagBook();

  const hookRef = useRef<HTMLTextAreaElement>(null);
  const corpsRef = useRef<HTMLTextAreaElement>(null);
  const fieldRefs = { hook: hookRef, corps: corpsRef };

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

  return (
    <div className="p-8 space-y-6" style={{ overflowY: 'auto' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <ContenuHeader accounts={accounts} />

        {/* Post Brief & Generator Form */}
        <PostGeneratorForm
          brief={brief}
          setBrief={setBrief}
          voice={voice}
          setVoice={setVoice}
          language={language}
          setLanguage={setLanguage}
          loading={loading}
          onGenerate={handleGenerate}
        />

        {/* TagBook Manager */}
        <TagBookPanel
          tagBook={tagBook}
          newTagAlias={newTagAlias}
          setNewTagAlias={setNewTagAlias}
          newTagName={newTagName}
          setNewTagName={setNewTagName}
          newTagUrn={newTagUrn}
          setNewTagUrn={setNewTagUrn}
          savingTag={savingTag}
          onAddTag={handleAddTag}
          onDeleteTag={handleDeleteTag}
        />

        {/* Live Post Editor & Preview */}
        {post && (
          <PostEditorPreview
            post={post}
            setPost={setPost}
            originalPost={originalPost}
            copied={copied}
            learning={learning}
            mention={mention}
            setMention={setMention}
            mentionMatches={mentionMatches}
            hookRef={hookRef}
            corpsRef={corpsRef}
            detectMention={detectMention}
            insertMention={(tag) => insertMention(tag, post, setPost, fieldRefs)}
            handleCopy={handleCopy}
            handleLearn={handleLearn}
          />
        )}

        {/* Schedule & Scheduled Posts Queue */}
        <PostSchedulerPanel
          post={post}
          accounts={accounts}
          queue={queue}
          targetAccountId={targetAccountId}
          setTargetAccountId={setTargetAccountId}
          scheduledDate={scheduledDate}
          setScheduledDate={setScheduledDate}
          scheduledTime={scheduledTime}
          setScheduledTime={setScheduledTime}
          setImageFile={setImageFile}
          scheduling={scheduling}
          onSchedule={() =>
            handleSchedule(post!, () => {
              setPost(null as any);
              setBrief('');
            })
          }
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
};
