import React, { useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { useLinkedInContent } from '../hooks/useLinkedInContent';
import { useLinkedInAccounts } from '../hooks/useLinkedInAccounts';
import { ContenuHeader } from './contenu/ContenuHeader';
import { PostGeneratorForm } from './contenu/PostGeneratorForm';
import { PostEditorPreview } from './contenu/PostEditorPreview';
import { PostSchedulerPanel } from './contenu/PostSchedulerPanel';

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
    handleDelete,
  } = useLinkedInAccounts();

  useEffect(() => {
    loadAccounts();
    loadQueue();

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
          onGenerate={() => handleGenerate()}
        />

        {/* Live Post Editor & Preview */}
        {post && (
          <PostEditorPreview
            post={post}
            setPost={setPost}
            originalPost={originalPost}
            copied={copied}
            learning={learning}
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
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};
