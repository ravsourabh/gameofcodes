// Bundled, rigged human identities. Asset paths are selected from this allow-list only.
export const AVATAR_MODELS = [
  {id:'Business_Male_04',name:'Adrian',description:'Bald, clean-shaven, shirt and waistcoat'},
  {id:'Business_Female_01',name:'Elena',description:'Shoulder-length hair, business jacket'},
  {id:'Male_Adult_05',name:'Jonah',description:'Casual short-sleeved shirt and shorts'},
  {id:'Business_Male_02',name:'Marcus',description:'Business suit and short hair'},
  {id:'Business_Female_02',name:'Sofia',description:'Shoulder-length hair, glasses and a jacket'},
  {id:'Female_Adult_07',name:'Nadia',description:'Pulled-back hair, jacket and jeans'},
];
export const REALISTIC_FEATURES=['model','colour','accessory'];
export const OUTFIT_TINTS={plum:'#aaa0bc',teal:'#8db8af',rust:'#bc9a88',navy:'#8899b5',sage:'#a6b59c',ivory:'#e6e0d2',original:'#ffffff'};
export function modelForAppearance(avatar){return avatar.realistic?.modelId || AVATAR_MODELS[avatar.seed%AVATAR_MODELS.length].id;}
export function validateRealistic(value){return value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length===1 && AVATAR_MODELS.some(m=>m.id===value.modelId);}
