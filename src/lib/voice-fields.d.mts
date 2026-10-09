export type VoiceDraftMode = 'issue' | 'closure';
export type VoiceDraftField = 'title' | 'equipmentId' | 'section' | 'kind' | 'priority' | 'hours' | 'works' | 'materialsText' | 'faultCode' | 'reason';
export interface VoiceFieldOptions {
  mode: VoiceDraftMode;
  equipment?: readonly {id: string | number; name?: string; aliases?: readonly string[]}[];
  sections?: readonly string[];
}
export interface VoiceFieldEvidence {source: 'dictation' | 'manual'; text: string; start?: number; end?: number}
export interface VoiceFieldUnresolved {
  text: string; start: number; end: number; field?: VoiceDraftField;
  reason: 'unknown_clause' | 'wrong_mode' | 'duplicate_field' | 'invalid_or_ambiguous_value';
}
export interface VoiceDraft {
  mode: VoiceDraftMode;
  transcript: string;
  fields: Partial<Record<Exclude<VoiceDraftField, 'hours'>, string>> & {hours?: number};
  evidence: Partial<Record<VoiceDraftField, VoiceFieldEvidence>>;
  unresolved: VoiceFieldUnresolved[];
  warnings: string[];
  requiresReview: true;
  executable: false;
}
export function parseVoiceFields(transcript: string, options: VoiceFieldOptions): VoiceDraft;
/** Human edits use displayed labels/units, e.g. 'Высокий' and '2 часа', not enum codes. */
export function editVoiceDraft(draft: VoiceDraft, field: VoiceDraftField, text: string, options: VoiceFieldOptions): VoiceDraft;
