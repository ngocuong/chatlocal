import http, {type Server} from 'node:http';
import fs from 'node:fs';import path from 'node:path';
const servers=new Map<string,{server:Server;url:string}>();
export async function previewWorkspace(cwd:string,name='index.html',preferredPort=0){
 if(preferredPort!==0&&(!Number.isInteger(preferredPort)||preferredPort<1024||preferredPort>65535))throw Error('Cổng xem trước không hợp lệ.');
 if(typeof name!=='string'||path.isAbsolute(name)||name.split(/[\\/]/).some(p=>p==='..'||p.startsWith('.')))throw Error('Đường dẫn xem trước không hợp lệ.');
 const target=path.resolve(cwd,name);
 if(!target.startsWith(cwd+path.sep)||!fs.existsSync(target)||!fs.realpathSync(target).startsWith(cwd+path.sep))throw Error('Không tìm thấy trang trong thư mục làm việc.');
 let entry=servers.get(cwd);
 if(!entry){
  const server=http.createServer((req,res)=>{
   try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    const relative=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
    if(relative.split('/').some(p=>p.startsWith('.')))throw Error();
    const file=path.resolve(cwd,relative);
    if(!file.startsWith(cwd+path.sep)||!fs.statSync(file).isFile()||!fs.realpathSync(file).startsWith(cwd+path.sep))throw Error();
    const types:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
   }catch{res.writeHead(404).end('Not found');}
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(preferredPort,'127.0.0.1',resolve)});
  entry={server,url:`http://127.0.0.1:${(server.address() as {port:number}).port}`};servers.set(cwd,entry);
 }
 return {url:entry.url+'/'+name.split('/').map(encodeURIComponent).join('/'),path:target};
}
export async function closePreviews(){await Promise.all([...servers.values()].map(({server})=>new Promise<void>(resolve=>server.close(()=>resolve()))));servers.clear();}
