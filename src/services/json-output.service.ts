export function parseJSONObject(text:string):any{
 const source=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
 try{return JSON.parse(source)}catch{}
 for(let start=source.indexOf('{');start>=0;start=source.indexOf('{',start+1)){
  let depth=0,quoted=false,escaped=false;
  for(let i=start;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(source.slice(start,i+1))}catch{break;}}}
 }
 throw Error('Model không trả về đối tượng JSON hợp lệ.');
}
