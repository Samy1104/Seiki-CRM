import React from 'react';
import { FileText } from 'lucide-react';
import type { PipelineStage } from '../../services/settingsService';
import type { Lead } from '../../services/leadsService';
import { EmailGenerator } from '../../components/EmailGenerator';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';

interface LeadGeneralInfoSectionProps {
  form: {
    company_name: string;
    contact_name: string;
    email: string;
    linkedin_url: string;
    phone: string;
    website: string;
    segment: 'Media' | 'Retail' | 'Instit' | '';
    deal_value: string;
    source: string;
    stage_id: string;
    note: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  customFields: Array<{ key: string; value: string }>;
  addCustomField: () => void;
  updateCustomField: (index: number, field: 'key' | 'value', val: string) => void;
  removeCustomField: (index: number) => void;
  stages: PipelineStage[];
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
}

export const LeadGeneralInfoSection: React.FC<LeadGeneralInfoSectionProps> = ({
  form,
  setForm,
  customFields,
  addCustomField,
  updateCustomField,
  removeCustomField,
  stages,
  onSubmit,
  onReset,
}) => {
  return (
    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
        <FileText size={14} className="text-amber" />
        Informations du lead
      </div>

      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Société *">
            <input
              type="text"
              placeholder="ex : LVMH"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Contact">
            <input
              type="text"
              placeholder="ex : Dir. Mobilité"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              placeholder="contact@société.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Téléphone">
            <input
              type="text"
              placeholder="ex : +33 6 00 00 00 00"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="LinkedIn">
            <input
              type="url"
              placeholder="linkedin.com/in/..."
              value={form.linkedin_url}
              onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Site Web">
            <input
              type="url"
              placeholder="www.entreprise.com"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Segment *">
            <Select
              value={form.segment}
              onValueChange={(val) => setForm({ ...form, segment: val as Lead['segment'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— Choisir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— Choisir</SelectItem>
                <SelectItem value="Media">Media</SelectItem>
                <SelectItem value="Retail">Retail</SelectItem>
                <SelectItem value="Instit">Instit</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Valeur (k€)">
            <input
              type="number"
              placeholder="ex : 45"
              value={form.deal_value}
              onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="Source">
            <Select
              value={form.source}
              onValueChange={(val) => setForm({ ...form, source: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="LinkedIn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                <SelectItem value="Événement">Événement</SelectItem>
                <SelectItem value="Réseau">Réseau</SelectItem>
                <SelectItem value="AndZup">AndZup</SelectItem>
                <SelectItem value="Inbound">Inbound</SelectItem>
                <SelectItem value="Chrome Extension">Chrome Extension</SelectItem>
                <SelectItem value="Autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Étape initiale">
            <Select
              value={form.stage_id}
              onValueChange={(val) => setForm({ ...form, stage_id: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Auto (selon score)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (selon score)</SelectItem>
                {stages.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Note" className="sm:col-span-2">
            <textarea
              placeholder="Contexte, déclencheur, informations utiles..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </Field>

          <Field label="Champs personnalisés" className="sm:col-span-2">
            {customFields.map((cf, i) => (
              <div key={i} className="mb-1.5 flex gap-2">
                <input
                  type="text"
                  placeholder="clé (ex: evenement)"
                  value={cf.key}
                  onChange={(e) => updateCustomField(i, 'key', e.target.value)}
                  className={`${inputClass} flex-1`}
                />
                <input
                  type="text"
                  placeholder="valeur (ex: Salon VivaTech)"
                  value={cf.value}
                  onChange={(e) => updateCustomField(i, 'value', e.target.value)}
                  className={`${inputClass} flex-[2]`}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomField(i)}>
                  ×
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addCustomField}>
              + Ajouter un champ
            </Button>
          </Field>
        </div>

        <div className="mt-5 flex gap-2.5">
          <Button type="submit" variant="primary" className="flex-1">
            Ajouter au pipeline
          </Button>
          <Button type="button" variant="secondary" onClick={onReset}>
            Réinitialiser
          </Button>
        </div>
      </form>

      <EmailGenerator
        contactName={form.contact_name}
        website={form.website}
        onSelectEmail={(email) => setForm((prev: any) => ({ ...prev, email }))}
      />
    </div>
  );
};
