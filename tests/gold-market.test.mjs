import assert from 'node:assert/strict';import {goldMarketData} from '../dist/services/gold-market.service.js';
const now=Date.parse('2026-10-12T18:00:00Z');let calls=[];
const fake=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('/price/')?{symbol:'XAU',currency:'USD',price:4200,updatedAt:'2026-10-12T17:59:00Z'}:{symbol:'XAU-USD-SPOT',series:[{date:'2026-10-12',close:'4200'},{date:'2026-10-09',close:'4000'}]}}};
assert.equal(await goldMarketData('giỏi',fake,now),null);assert.equal(calls.length,0);
assert.equal(await goldMarketData('viết prompt phân tích giá vàng',fake,now),null);
let data=await goldMarketData('phân tích giá vàng hiện tại',fake,now);assert.equal(data.quote.fresh,true);assert.equal(data.quote.price,4200);assert.ok(Math.abs(data.history.latestDailyChangePercent-5)<0.0001);assert.match(data.receipt,/USD\/ounce/);assert.match(data.receipt,/13\/10\/2026|13-10-2026/);
data=await goldMarketData('giá vàng',fake,now+3600000);assert.equal(data.quote.fresh,false);assert.match(data.receipt,/độ trễ/);
data=await goldMarketData('giá vàng',async()=>{throw Error('offline')},now);assert.equal(data.quote,null);assert.match(data.receipt,/chưa lấy được/);
console.log('PASS: verified quote, source time, daily history, timezone, stale data and network failure; ordinary chat/prompt writing makes no market requests');
