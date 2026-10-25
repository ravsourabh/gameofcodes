type Provider = { id: string; name: string; description: string; installed: boolean; state: string; message: string; loginCommand: string; installUrl: string };
export type ConnectionState = { configured: boolean; provider: string; selectedProvider: string; providers: Provider[]; brains?: Record<string,string> };
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export class ConnectionPanel {
  private busy = false;
  constructor(private changed: (state: ConnectionState) => void) {
    document.querySelector('#provider-cards')!.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-provider]');
      if (button && !this.busy) void this.act(button.dataset.provider!, button.dataset.action!);
    });
    document.querySelector('#provider-refresh')!.addEventListener('click', () => void this.refresh());
  }
  update(state: ConnectionState) {
    if (!state.providers) return;
    this.changed(state);
    document.querySelector('#provider-cards')!.innerHTML = state.providers.map(provider => `
      <article class="provider-card ${provider.id === state.selectedProvider ? 'chosen' : ''}">
        <div class="provider-card-heading"><h3>${escape(provider.name)}</h3><span class="provider-badge ${provider.state === 'connected' ? 'verified' : ''}">${provider.state === 'connected' ? 'Verified' : provider.installed ? 'Installed' : 'Not installed'}</span></div>
        <p>${escape(provider.description)}</p><p class="provider-detail">${escape(provider.message)}</p>
        <div class="provider-command"><span>Sign in in your terminal</span><code>${escape(provider.loginCommand)}</code></div>
        <div class="provider-card-actions"><button class="secondary-button" data-provider="${escape(provider.id)}" data-action="select" ${provider.id === state.selectedProvider ? 'disabled' : ''}>${provider.id === state.selectedProvider ? 'Selected' : 'Use this assistant'}</button><button class="secondary-button" data-provider="${escape(provider.id)}" data-action="check" ${!provider.installed ? 'disabled' : ''}>Check connection</button><a href="${escape(provider.installUrl)}" target="_blank" rel="noopener noreferrer">Setup guide ↗</a></div>
      </article>`).join('');
    document.querySelector('#provider-description')!.textContent = state.configured ? `${state.provider} is selected. Replies use its local sign-in and account allowance.` : 'Select an installed assistant and complete its official sign-in on this computer.';
  }
  async refresh() {
    if (this.busy) return;
    try { const response = await fetch('/api/court/status'); if (!response.ok) throw new Error('The local assistant service is unavailable.'); this.update(await response.json()); }
    catch (error) { this.error(error); }
  }
  private error(error: unknown) { document.querySelector('#provider-error')!.textContent = error instanceof Error ? error.message : 'The connection could not be checked.'; }
  private async act(provider: string, action: string) {
    this.busy = true;
    const status = document.querySelector('#provider-error')!;
    status.textContent = action === 'check' ? 'Waiting for a real reply from the local assistant…' : 'Selecting assistant…';
    const buttons = document.querySelectorAll<HTMLButtonElement>('#provider-dialog button[data-provider], #provider-refresh'); buttons.forEach(button => button.disabled = true);
    try {
      const response = await fetch('/api/court/provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, action }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'The local assistant could not connect.');
      this.update(data); status.textContent = action === 'check' ? 'Connection verified with a real assistant reply.' : 'Assistant selected. Close this panel to address your court.';
    } catch (error) { this.error(error); }
    finally { this.busy = false; document.querySelector<HTMLButtonElement>('#provider-refresh')!.disabled = false; await this.refresh(); }
  }
}
