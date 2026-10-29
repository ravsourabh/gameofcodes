const params=new URLSearchParams(location.search),type=params.get('type')||'banner';
const brand=await fetch('brand.json').then(r=>r.json());
const root=document.querySelector('#art'),logo='source/show-logo.png';
const badge='source/profile-badge-generated.png';
const el=(tag,attrs={},children=[])=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs))if(k==='text')e.textContent=v;else if(k==='class')e.className=v;else e.setAttribute(k,v);for(const child of children)e.append(child);return e};
const add=(tag,attrs={},children=[])=>{const e=el(tag,attrs,children);root.append(e);return e};
const img=(src,cls)=>add('img',{src,class:cls,alt:brand.showName});
const pub=cls=>add('div',{class:'publisher '+(cls||''),text:brand.publisher});
const base=()=>{root.classList.add('stage');add('div',{class:'red-slice'})};
const cast=params.get('model')||brand.featuredCharacter.modelId,allowed=['Business_Male_04','Business_Female_01','Male_Adult_05','Business_Male_02','Business_Female_02','Female_Adult_07','Host_Anchor_01'];
if(!allowed.includes(cast))throw Error('Unknown avatar');
const expression=params.get('expression')||brand.featuredCharacter.expression;if(!['neutral','smile','surprised'].includes(expression))throw Error('Unknown expression');
const portrait=type.includes('portrait')||type.startsWith('vertical');
if(type==='profile'||type==='profile-circle'){
 img(badge,'badge-img');if(type==='profile-circle')root.style.clipPath='circle(50%)';
}else if(type==='watermark'){
 const box=add('div',{class:'watermark'});box.append(el('img',{src:logo,alt:brand.showName}));
}else if(type==='banner'){
 base();const safe=add('div',{class:'banner-safe'});safe.append(el('img',{src:logo,class:'logo banner-logo',alt:brand.showName}),el('img',{src:'cast/'+brand.featuredCharacter.modelId+'-neutral.png',class:'banner-cast',alt:brand.featuredCharacter.name}));
 safe.append(el('div',{class:'banner-copy'},[el('div',{class:'eyebrow',text:'HINDI COMEDY NEWSROOM'}),el('h1',{text:brand.tagline}),el('div',{class:'publisher',text:brand.publisher})]));
 add('div',{class:'banner-code',text:'FICTIONAL NEWS. FAMILIAR CHAOS.'});
 if(params.has('guides'))add('div',{class:'guide'});
}else if(type==='thumbnail'){
 base();img(logo,'logo thumb-logo');add('div',{class:'thumb-label',text:'बात का बवाल · कॉमेडी न्यूज़रूम'});
 const h=add('h1',{class:'thumb-head'});h.append(el('span',{text:params.get('hook1')||'ऑटो वाला'}),el('br'),el('em',{text:params.get('hook2')||'मान कैसे गया?'}));
 img('cast/'+cast+'-'+expression+'.png','cast');add('div',{class:'topic-line'});pub('thumb-footer');
}else if(type.startsWith('vertical')){
 base();img(logo,'logo vertical-logo');const h=add('h1',{class:'vertical-hook'});h.append(el('span',{text:params.get('hook1')||'हाँ बोला…'}),el('br'),el('em',{text:params.get('hook2')||'शक हो गया!'}));
 img('cast/'+cast+'-'+expression+'.png','cast vertical-cast');const foot=add('div',{class:'vertical-footer'});foot.append(el('div',{class:'publisher',text:brand.publisher}));
 if(params.has('guides'))add('div',{class:'vertical-guides'});
}else if(type.startsWith('caption')){
 const box=add('div',{class:'caption'+(portrait?' portrait':'')});box.append(el('span',{text:params.get('caption')||'तो तुम बैठे क्यों?'}));
}else if(type.startsWith('lower')){
 const box=add('div',{class:'lower'+(portrait?' portrait':'')});box.append(el('strong',{text:params.get('name')||'पैनलिस्ट का नाम'}),el('small',{text:params.get('role')||'बात का बवाल'}));
}else if(type.startsWith('outro')){
 base();root.classList.add('end');if(portrait)root.classList.add('portrait');img(logo,'logo end-logo');
 add('div',{class:'end-title',text:'अगला बवाल किस बात पर?'});add('div',{class:'end-sub',text:'अपनी राय लिखिए। फिर मिलेंगे, एक नए मुद्दे के साथ।'});pub('end-publisher');
}else if(type.startsWith('intro')){
 base();root.classList.add('intro');if(portrait)root.classList.add('portrait');img(logo,'logo intro-logo');add('div',{class:'intro-tag',text:brand.tagline});add('div',{class:'sweep'});
}else throw Error('Unknown layout');
window.setArtworkFrame=(time,duration=2)=>{const progress=Math.min(1,Math.max(0,time/duration));root.style.setProperty('--progress',String(progress));root.style.setProperty('--reveal',String(Math.min(1,Math.max(0,(time-.08)/.55))))};
window.setArtworkFrame(2);
await document.fonts.ready;
await Promise.all([...document.images].map(i=>i.decode().catch(()=>{throw Error('Image unavailable: '+i.getAttribute('src'));}))).catch(error=>{window.artworkFailure=error.message;throw error;});
window.artworkReady=true;
