import React from 'react';
import { useAddLeadForm } from '../hooks/useAddLeadForm';
import { LeadGeneralInfoSection } from './addlead/LeadGeneralInfoSection';
import { LeadScoringSection } from './addlead/LeadScoringSection';

interface AddLeadProps {
  setView: (view: string) => void;
}

export const AddLead: React.FC<AddLeadProps> = ({ setView }) => {
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
      <div className="mb-6">
        <div className="font-display text-3xl font-bold text-ink">Ajouter un lead</div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left Column: Form Info */}
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

        {/* Right Column: Scoring ICP */}
        <LeadScoringSection
          scores={scores}
          onScoreChange={handleScoreChange}
          totalScore={totalScore}
          recommendation={recommendation}
        />
      </div>
    </div>
  );
};

export default AddLead;
