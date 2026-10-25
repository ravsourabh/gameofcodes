export const WIDTH = 1280;
export const HEIGHT = 800;
export const isProjectId = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id) && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);

export function parseInput(raw) {
  if (typeof raw !== 'string' || raw.length > 8192) return null;
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  if (value.type === 'click' && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    return { type: 'click', x: Math.max(0, Math.min(WIDTH - 1, value.x)), y: Math.max(0, Math.min(HEIGHT - 1, value.y)) };
  }
  if (value.type === 'text' && typeof value.text === 'string' && value.text.length <= 240) return { type: 'text', text: value.text };
  if (value.type === 'key' && ['Backspace', 'Enter', 'Escape', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(value.key)) return { type: 'key', key: value.key };
  if (['reload', 'export', 'ping'].includes(value.type)) return { type: value.type };
  return null;
}
