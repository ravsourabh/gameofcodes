const KEY = 'sovereign-board-v1';
const columns = [{ id: 'todo', title: 'To do' }, { id: 'progress', title: 'In progress' }, { id: 'done', title: 'Done' }];
const seed = { tasks: [
  { id: crypto.randomUUID(), title: 'Sketch the first idea', status: 'todo', priority: 'normal' },
  { id: crypto.randomUUID(), title: 'Make something worth sharing', status: 'todo', priority: 'urgent' },
  { id: crypto.randomUUID(), title: 'Explore the possibilities', status: 'progress', priority: 'normal' },
  { id: crypto.randomUUID(), title: 'Find a place to begin', status: 'done', priority: 'normal' },
], activity: [] };
let data;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch {}
if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.activity)) data = seed;
let urgentOnly = false;
let editingId = null;
let priority = 'normal';
let status = 'todo';
let upper = false;
let keyboardVisible = new URLSearchParams(location.search).get('keyboard') === '1';
const $ = (selector) => document.querySelector(selector);
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function persist(action) {
  if (action) data.activity.unshift({ text: action, at: Date.now() });
  data.activity = data.activity.slice(0, 80);
  localStorage.setItem(KEY, JSON.stringify(data));
}
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2200); }
function render() {
  $('#board').innerHTML = columns.map(col => {
    const tasks = data.tasks.filter(task => task.status === col.id && (!urgentOnly || task.priority === 'urgent'));
    return `<section class="column ${col.id}" aria-label="${col.title}"><div class="column-header"><i class="dot"></i>${col.title}<span class="column-count">${tasks.length}</span><button class="column-add" data-add="${col.id}" aria-label="Add task to ${col.title}">＋</button></div>${tasks.length ? tasks.map(task => `<article class="task"><button class="task-title" data-edit="${esc(task.id)}">${esc(task.title)}</button><div class="task-meta"><span class="tag ${task.priority}">${task.priority === 'urgent' ? '⚑ Urgent' : '◇ Normal'}</span>${col.id === 'done' ? '<span class="done-label">✓ Complete</span>' : `<button class="move" data-move="${esc(task.id)}" aria-label="Move ${esc(task.title)} to ${col.id === 'todo' ? 'In progress' : 'Done'}">→</button>`}</div></article>`).join('') : '<div class="empty">A little room for something new.</div>'}<button class="add-column" data-add="${col.id}">＋ Add a task</button></section>`;
  }).join('');
  $('#task-count').textContent = `${data.tasks.length} tasks`;
  $('#priority-filter').classList.toggle('active', urgentOnly);
  $('#priority-filter').innerHTML = `${urgentOnly ? '⚑ &nbsp; Urgent only' : '◇ &nbsp; All priorities'} <span>⌄</span>`;
  $('#activity').innerHTML = data.activity.length ? data.activity.map(item => `<div class="activity-row"><span>✦</span><span>${esc(item.text)}</span><time>${new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('') : '<div class="empty">Your next action starts the story.</div>';
}
function updateChoices() {
  document.querySelectorAll('[data-priority]').forEach(button => button.classList.toggle('selected', button.dataset.priority === priority));
  document.querySelectorAll('[data-status]').forEach(button => button.classList.toggle('selected', button.dataset.status === status));
}
function openEditor(id = null, initialStatus = 'todo') {
  const task = data.tasks.find(t => t.id === id);
  editingId = task ? id : null;
  priority = task?.priority || 'normal'; status = task?.status || initialStatus;
  $('#title').value = task?.title || '';
  $('#editor-title').textContent = task ? 'A little refinement' : 'A new task';
  $('#save-task').textContent = task ? 'Save changes ↗' : 'Create task ↗';
  $('#delete-task').hidden = !task;
  updateChoices(); renderKeyboard();
  $('#editor').showModal(); $('#title').focus();
}
function closeEditor() { $('#editor').close(); editingId = null; }
function renderKeyboard() {
  $('#keyboard').hidden = !keyboardVisible;
  $('#keyboard-toggle').textContent = keyboardVisible ? 'Hide keyboard' : 'Show keyboard';
  const rows = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  $('#keyboard').innerHTML = rows.map((row, i) => `<div class="keyboard-row">${i === 3 ? `<button type="button" data-key="shift" class="wide">${upper ? '⇧ SHIFT' : '⇧ Shift'}</button>` : ''}${[...row].map(letter => `<button type="button" data-key="${letter}">${upper ? letter.toUpperCase() : letter}</button>`).join('')}${i === 3 ? '<button type="button" data-key="backspace" class="wide">⌫ Delete</button>' : ''}</div>`).join('') + '<div class="keyboard-row"><button type="button" data-key="-">−</button><button type="button" data-key="space" class="space">space</button><button type="button" data-key=".">.</button><button type="button" data-key=",">,</button><button type="button" data-key="!">!</button><button type="button" data-key="?">?</button></div>';
}
$('#task-form').addEventListener('submit', event => {
  event.preventDefault();
  const title = $('#title').value.trim();
  if (!title) { $('#title').focus(); return; }
  if (editingId) Object.assign(data.tasks.find(t => t.id === editingId), { title, priority, status });
  else data.tasks.push({ id: crypto.randomUUID(), title, priority, status });
  persist(`${editingId ? 'Updated' : 'Created'} “${title}”`);
  closeEditor(); render(); toast('Task saved. A small step forward.');
});
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.add) openEditor(null, button.dataset.add);
  if (button.dataset.edit) openEditor(button.dataset.edit);
  if (button.dataset.move) {
    const task = data.tasks.find(t => t.id === button.dataset.move);
    task.status = task.status === 'todo' ? 'progress' : 'done';
    persist(`Moved “${task.title}” to ${task.status === 'done' ? 'Done' : 'In progress'}`); render(); toast('Progress, one step at a time.');
  }
  if (button.dataset.priority) { priority = button.dataset.priority; updateChoices(); }
  if (button.dataset.status) { status = button.dataset.status; updateChoices(); }
  if (button.dataset.key) {
    const key = button.dataset.key, input = $('#title');
    if (key === 'shift') { upper = !upper; renderKeyboard(); return; }
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
    if (key === 'backspace') {
      const from = start === end ? Math.max(0, start - 1) : start;
      input.setRangeText('', from, end, 'end');
    } else if (input.value.length < 120) input.setRangeText(key === 'space' ? ' ' : upper ? key.toUpperCase() : key, start, end, 'end');
    input.focus();
  }
});
// Keep the selection while a user points at a hand-keyboard key.
$('#keyboard').addEventListener('mousedown', event => event.preventDefault());
$('#new-task').addEventListener('click', () => openEditor());
$('#cancel-editor').addEventListener('click', closeEditor);
$('#close-editor').addEventListener('click', closeEditor);
$('#delete-task').addEventListener('click', () => {
  const task = data.tasks.find(t => t.id === editingId);
  data.tasks = data.tasks.filter(t => t.id !== editingId); persist(`Deleted “${task.title}”`); closeEditor(); render(); toast('Task deleted.');
});
$('#priority-filter').addEventListener('click', () => { urgentOnly = !urgentOnly; render(); });
$('#keyboard-toggle').addEventListener('click', () => { keyboardVisible = !keyboardVisible; renderKeyboard(); });
$('#board-tab').addEventListener('click', () => { $('#board').hidden = false; $('#activity').hidden = true; $('#board-tab').classList.add('active'); $('#activity-tab').classList.remove('active'); });
$('#activity-tab').addEventListener('click', () => { $('#board').hidden = true; $('#activity').hidden = false; $('#activity-tab').classList.add('active'); $('#board-tab').classList.remove('active'); });
persist(); render();
