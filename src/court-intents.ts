import type { CourtRole } from './characters';
import type { BrainProvider } from './brains';

export function providerFromSpeech(text: string, headOpen = false): BrainProvider | undefined {
  const value = text.toLowerCase().trim().replace(/[.!?,]/g, '');
  if (/\b(?:claude|anthropic)\b/.test(value) || headOpen && /\b(?:cloud|clawed|clod)\b/.test(value)) return 'claude';
  if (/\b(?:gemini|google)\b/.test(value)) return 'gemini';
  if (/\b(?:chat\s?gpt|codex|openai)\b/.test(value)) return 'codex';
  if (/\b(?:muse|meta|llama)\b/.test(value)) return 'muse';
  return undefined;
}
export type CourtIntent = 'court' | 'code' | 'preview' | 'settings' | 'approve' | 'tour' | 'milestones' | 'meetingRoom' | 'workspace' | 'wallOfFame';
export function navigationIntent(text: string): CourtIntent | null {
  const value = text.toLowerCase().replace(/[.!?,]/g, '').replace(/\s+/g, ' ').trim();
  // Only command-shaped phrases navigate; an app request mentioning code stays a request.
  if (/^(?:(?:virus|please|can you|could you)\s+)*(?:approve(?: this| the)? plan|approve|build it|start building|go ahead and build)$/.test(value)) return 'approve';
  if (/\b(?:give me|show me|replay|restart|resume|start) (?:the |a )?(?:tour|guide|onboarding)\b/.test(value)) return 'tour';
  if (!/^(?:(?:virus|please|can you|could you)\s+)*(?:take|bring|lead|guide|show|open|go|return|back|enter|review|view|edit|change|manage|help)\b/.test(value)) return null;
  if (/\b(?:settings|directory|folder|sign in|sign up|signup|connect|connection)\b/.test(value)) return 'settings';
  if (/\b(?:milestones|charter)\b/.test(value)) return 'milestones';
  if (/\b(?:source|code)\b/.test(value)) return 'code';
  if (/\b(?:court|throne)\b/.test(value)) return 'court';
  if (/\b(?:preview|app|application|build|work)\b/.test(value) && !/\bworkspace\b/.test(value)) return 'preview';
  if (/\bmeeting\b/.test(value)) return 'meetingRoom';
  if (/\b(?:workspace|desk)\b/.test(value)) return 'workspace';
  if (/\b(?:wall|fame|achievements)\b/.test(value)) return 'wallOfFame';
  return null;
}
export function addressedRole(text: string): CourtRole | null {
  const match = text.match(/^(?:hey\s+)?(virus|elara|bram|iris|mira)[,\s]/i);
  return match ? ({ virus: 'virus', elara: 'architect', bram: 'builder', iris: 'inspector', mira: 'artiste' } as const)[match[1].toLowerCase() as 'virus'] : null;
}
