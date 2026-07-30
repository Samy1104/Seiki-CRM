import React, { useState } from 'react';
import { useAddLeadForm } from '../hooks/useAddLeadForm';
import { LeadGeneralInfoSection } from './addlead/LeadGeneralInfoSection';
import { LeadScoringSection } from './addlead/LeadScoringSection';
import { BulkImportPanel } from './addlead/BulkImportPanel';
import { PageTitle } from '../components/ui/PageTitle';
import { SegmentedToggle } from '../components/ui/SegmentedToggle';

interface AddLeadProps {
  setView: (view: string) => void;
}

type AddLeadMode = 'single' | 'bulk';

export const AddLead: React.FC<AddLeadProps> = ({ setView }) => {
  const [mode, setMode] = useState<AddLeadMode>('single');
  const {
    form,
    setForm,
    scores,
    handleScoreChange,
    customFields,
    addCustomField,
    updateCustomField,
    removeCustomField,
    stages,
    totalScore,
    recommendation,
    handleReset,
    handleSubmit,
  } = useAddLeadForm(setView);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Ajouter un lead</PageTitle>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: 'Lead unique' },
            { value: 'bulk', label: 'Import en masse' },
          ]}
        />
      </div>

      {mode === 'single' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <LeadGeneralInfoSection
            form={form}
            setForm={setForm}
            customFields={customFields}
            addCustomField={addCustomField}
            updateCustomField={updateCustomField}
            removeCustomField={removeCustomField}
            stages={stages}
            onSubmit={handleSubmit}
            onReset={handleReset}
          />
          <LeadScoringSection
            scores={scores}
            onScoreChange={handleScoreChange}
            totalScore={totalScore}
            recommendation={recommendation}
          />
        </div>
      ) : (
        <BulkImportPanel setView={setView} />
      )}
    </div>
  );
};

export default AddLead;
