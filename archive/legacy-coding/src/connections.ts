export type Provider = { id: string; name: string; description: string; installed: boolean; state: string; message: string; loginCommand: string; installUrl: string };
export type ConnectionState = { configured: boolean; provider: string; selectedProvider: string; providers: Provider[]; workspaceDefault?:string; mode?: 'local'|'cloud'; setup?: {profileId:string;profileName:string;mode:'cloud'|'local';activity:'explore'|'plan';workspace:string|null}|null; brains?: Record<string,string> };
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
    const cloud=state.mode==='cloud';
    document.querySelector('#connect-provider')!.textContent=cloud?'Cloud model status':'Connect local assistants';
    document.querySelector('#provider-refresh')!.textContent=cloud?'Refresh API availability':'Refresh installed assistants';
    document.querySelector('#provider-title')!.textContent=cloud?'Cloud models':'Connect local assistants';
    document.querySelector('#provider-intro')!.textContent=cloud?'Models run through server-managed APIs. Browser chat sign-in is not used.':'Sign in to each installed assistant using its official CLI, then check its connection here.';
    document.querySelector('#provider-usage')!.textContent=cloud?'Configured means the API is available to request. Verified means it has returned a successful response in this server session.':'Connection checks use your local assistant account allowance. At least one verified assistant is needed for local setup.';

    document.querySelector('#provider-cards')!.innerHTML = state.providers.map(provider => `
      <article class="provider-card ${provider.id === state.selectedProvider ? 'chosen' : ''}">
        <div class="provider-card-heading"><h3>${escape(provider.name)}</h3><span class="provider-badge ${provider.state === 'connected' ? 'verified' : ''}">${['disabled','error','not-installed'].includes(provider.state)?'Unavailable':provider.state === 'connected' ? 'Verified' : provider.installed ? cloud?'Configured':'Ready' : 'Not available'}</span></div>
        <p>${escape(cloud?`${provider.name} via server-managed API.`:provider.description)}</p><p class="provider-detail">${escape(provider.message)}</p>
        ${!cloud&&provider.loginCommand?`<div class="provider-command"><span>Sign in in your terminal</span><code>${escape(provider.loginCommand)}</code></div>`:''}
        ${cloud?`<small class="provider-detail">${provider.state==='connected'?'API verified':provider.installed?'Configured · verified on next response':'Unavailable on this server'}</small>`:`<div class="provider-card-actions"><button class="secondary-button" data-provider="${escape(provider.id)}" data-action="select" ${provider.id === state.selectedProvider || !provider.installed || provider.state==='disabled' ? 'disabled' : ''}>${!provider.installed||provider.state==='disabled'?'Unavailable':provider.id === state.selectedProvider ? 'Selected' : 'Use this assistant'}</button><button class="secondary-button" data-provider="${escape(provider.id)}" data-action="check" ${!provider.installed||cloud ? 'disabled' : ''}>${cloud?provider.state==='connected'?'API verified':provider.installed?'Checks on first request':'Unavailable':'Check connection'}</button><a href="${escape(provider.installUrl)}" target="_blank" rel="noopener noreferrer">Setup guide ↗</a></div>`}

      </article>`).join('');
    document.querySelector('#provider-description')!.textContent = cloud?'Cloud mode · server-managed APIs. Assign models to individual court members.':state.configured?'Local mode · official CLI accounts on this computer.':'Local mode · sign in and check an installed assistant on this computer.';
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
