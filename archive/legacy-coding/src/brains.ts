import * as THREE from 'three';
import type { CourtRole } from './characters';
import { providerFromSpeech } from './court-intents';

export type BrainProvider = 'muse' | 'codex' | 'claude' | 'gemini' | 'nanoBanana';
export const BRAINS = {
  muse:       { name: 'Muse',          color: '#8fbfff', logo: '/brands/muse.svg'   },
  codex:      { name: 'ChatGPT',       color: '#98d8bc', logo: '/brands/codex.svg'  },
  claude:     { name: 'Claude',        color: '#e1ad8c', logo: '/brands/claude.svg' },
  gemini:     { name: 'Gemini',        color: '#4285f4', logo: '/brands/gemini.svg' },
  nanoBanana: { name: 'Nano Banana',   color: '#f4d03f', logo: '/brands/gemini.svg' },
};
// Brains shown in the standard picker (text workers). Artiste uses artiste-specific brains.
export const TEXT_BRAIN_IDS: BrainProvider[] = ['muse', 'codex', 'claude', 'gemini'];
export const ARTISTE_BRAIN_IDS: BrainProvider[] = ['nanoBanana', 'codex'];
export const brainIds = TEXT_BRAIN_IDS;
export const isBrain = (id: unknown): id is BrainProvider => Object.prototype.hasOwnProperty.call(BRAINS, id as string);
const textures = new Map<BrainProvider, THREE.Texture>();
export function brainMark(provider: BrainProvider, size: number, opacity = 1) {
  let texture = textures.get(provider);
  if (!texture) { texture = new THREE.TextureLoader().load(BRAINS[provider].logo); texture.colorSpace = THREE.SRGBColorSpace; textures.set(provider, texture); }
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false, toneMapped: false }));
}

// Small, explicit device commands work after transcription without another model
// turn. Application requests remain on the normal assistant path.
export function brainCommand(text: string, selected: CourtRole, headOpen = false): { role: CourtRole; open: boolean; provider?: BrainProvider } | null {
  let value = text.toLowerCase().replace(/[,.!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (value.length > 150) return null;
  const roles = { elara: 'architect', bram: 'builder', iris: 'inspector', virus: 'virus', mira: 'artiste' } as const;
  let role = selected;
  for (const [name, id] of Object.entries(roles)) {
    if (new RegExp(`\\b${name}\\b`).test(value)) { role = id; value = value.replace(new RegExp(`\\b${name}(?:'s)?\\b`, 'g'), 'your').trim(); break; }
  }
  value = value.replace(/^(?:hey |okay |please |can you |could you |would you |your )+/, '').trim();
  const head = /^(?:open|close|shut)\b.*\b(?:head|brain|mind)\b/.test(value);
  const named = providerFromSpeech(value, headOpen);
  if (headOpen && named && /^(?:(?:use|choose|select|switch to|change to|make it) )?(?:claude|cloud|clawed|clod|anthropic|gemini|google|muse|meta|llama|chat ?gpt|codex|openai)$/.test(value)) return { role, open: true, provider: named };
  const change = /^(?:change|swap|switch|replace)\b.*\b(?:brain|mind|model)\b/.test(value) || /^use\s+(?:muse|meta|llama|claude|cloud|gemini|google|chat\s?gpt|codex|openai)\b/.test(value);
  if (!head && !change) return null;
  const provider: BrainProvider | undefined = /\b(?:nano.?banana|banana)\b/.test(value) ? 'nanoBanana' : providerFromSpeech(value, true);
  return { role, open: !/^(?:close|shut)\b/.test(value), provider };
}
