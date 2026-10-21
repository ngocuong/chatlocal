export const goldQuoteUrl='https://api.gold-api.com/price/XAU';
export const goldHistoryUrl='https://api.goldprice.dev/v1/public/xau-history';
export function needsGoldData(text:string){return /(?:giá vàng|vàng thế giới|xau\/?usd|gold price)/i.test(text)&&!/(?:prompt|lời nhắc|viết bài|dịch|translate)/i.test(text);}
export async function goldMarketData(request:string,fetcher:typeof fetch=fetch,now=Date.now()){
 if(!needsGoldData(request))return null;
 async function json(url:string){const response=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('HTTP '+response.status);return response.json() as Promise<any>;}
 const analysis=/(?:phân tích|xu hướng|so sánh|analysis|trend)/i.test(request);
 const [quoteResult,historyResult]=await Promise.allSettled([json(goldQuoteUrl),analysis?json(goldHistoryUrl):Promise.resolve(null)]);
 let quote:null|{price:number;updatedAt:string;fresh:boolean;source:string}=null;
 if(quoteResult.status==='fulfilled'){
  const q=quoteResult.value,time=Date.parse(q.updatedAt);
  if(q.symbol==='XAU'&&q.currency==='USD'&&Number.isFinite(q.price)&&q.price>0&&Number.isFinite(time)&&time<=now+300000)quote={price:q.price,updatedAt:q.updatedAt,fresh:now-time<=15*60*1000,source:goldQuoteUrl};
 }
 let history:null|{source:string;closes:Array<{date:string;close:number}>;latestDailyChangePercent:number|null}=null;
 if(historyResult.status==='fulfilled'&&historyResult.value?.symbol==='XAU-USD-SPOT'){
  const closes=(historyResult.value.series||[]).map((r:any)=>({date:r.date,close:Number(r.close)})).filter((r:any)=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&Number.isFinite(r.close)&&r.close>0&&Date.parse(r.date)<=now).sort((a:any,b:any)=>b.date.localeCompare(a.date)).slice(0,30);
  if(closes.length)history={source:goldHistoryUrl,closes,latestDailyChangePercent:closes.length>1?(closes[0].close/closes[1].close-1)*100:null};
 }
 const receipt=quote?`Giá vàng thế giới tham khảo: ${quote.price.toLocaleString('vi-VN',{maximumFractionDigits:2})} USD/ounce. ${quote.fresh?'Cập nhật':'Dữ liệu có độ trễ, thời điểm nguồn cập nhật'}: ${new Date(quote.updatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false})} (giờ Việt Nam). Nguồn: ${goldQuoteUrl}. Đây là giá spot tham khảo, không phải giá mua/bán SJC hoặc giá giao dịch bảo đảm.`:'Hiện chưa lấy được giá vàng thế giới có thời gian cập nhật hợp lệ từ nguồn dữ liệu. Không thể xác nhận giá hiện tại trong lượt này.';
 return {quote,history,receipt,fetchedAt:new Date(now).toISOString()};
}
