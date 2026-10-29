// Gemini's decoder can reject nested bounded arrays with an opaque 400.
// Keep the JSON shape, IDs and enums constrained; enforce counts in our host
// validators. Descriptions retain the creative/storage bounds for the model.
export function geminiSchema(schema){
 if(!schema)return schema;const result=structuredClone(schema);
 const visit=node=>{if(!node||typeof node!=='object')return;
  if(node.type==='array'){
   const bounds=[node.minItems!==undefined?`At least ${node.minItems} items.`:'',node.maxItems!==undefined?`At most ${node.maxItems} items.`:''].filter(Boolean);
   if(bounds.length)node.description=[node.description,...bounds].filter(Boolean).join(' ');
   delete node.minItems;delete node.maxItems;
  }
  for(const child of Object.values(node))visit(child);
 };visit(result);return result;
}
