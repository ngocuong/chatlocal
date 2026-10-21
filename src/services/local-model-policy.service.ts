import {codexModelSlug} from './codex-completion.service.js';
// Local is intentionally restricted to the ChatGPT conversation connection.
// Work aliases are excluded too: they must not silently consume Work/Codex usage.
export function isWorkQuotaModel(id:string){return !!codexModelSlug(id)||/-wm$/i.test(id)||/codex/i.test(id);}
export const blockedModelMessage='Model Work/Codex đã bị tắt theo yêu cầu của bạn để local không gọi kết nối dùng hạn mức Work/Codex. Hãy chọn Tự động · ChatGPT hoặc model ChatGPT thường. ChatGPT thường vẫn có giới hạn riêng.';
