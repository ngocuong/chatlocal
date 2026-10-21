// tqdm reports denoising steps, not total end-to-end runtime.
export function imageStepProgress(log:string):string|undefined{
 const matches=[...log.replace(/\x1b\[[0-9;]*m/g,'').matchAll(/(?:^|[\r\n])[ \t]*(\d{1,3})%\|[^\r\n]*?\|\s*(\d+)\/(\d+)/g)];
 const match=matches.at(-1);if(!match)return;
 const done=Number(match[2]),total=Number(match[3]);if(!total||done>total)return;
 const percent=Math.round(done/total*100);
 return percent===100?'Đã xử lý 100% bước vẽ · đang giải mã và lưu ảnh…':`Đang vẽ ảnh · ${percent}% · bước ${done}/${total}`;
}
