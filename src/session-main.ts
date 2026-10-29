// Historical session links retain their reader/UI. Fresh visits enter the studio.
const parameters=new URL(location.href).searchParams;
if(parameters.has('session')||parameters.has('project')||parameters.get('legacy-session')==='1')void import('./legacy-session-main');
else void import('./studio-main');
export {};
