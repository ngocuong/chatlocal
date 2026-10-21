import { OpenAIBackendAPI, type ConversationMessage } from "../services/openai-backend.service.js";

function sanitizeOutputText(text: string): string {
  let cleaned = text;
  // ChatGPT web sometimes returns rich annotation markers with private-use characters \ue200...\ue201
  cleaned = cleaned.replace(/\ue200([^\ue201]*)\ue201/g, (_match, p1) => {
    const parts = p1.split("\ue202").map((s: string) => s.trim());
    const kind = parts[0]?.toLowerCase() || "";
    const data = parts.slice(1);
    if (kind === "url") {
      const label = data[0] || "";
      const url = data[1] || "";
      if (label && (url.startsWith("http://") || url.startsWith("https://"))) {
        return `${label} (${url})`;
      }
      return label || url;
    }
    return data.find((d: string) => d.length > 0) || "";
  });
  cleaned = cleaned.replace(/\ue200[^\ue201]*$/g, "");
  return cleaned;
}

function checkUpstreamError(event:Record<string,unknown>){
 const failure=event.error;
 if(!failure&&event.type!=='error')return;
 const details=failure&&typeof failure==='object'?failure as Record<string,unknown>:{};
 const rawCode=event.error_code||details.code||'upstream_error';
 const code=typeof rawCode==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(rawCode)?rawCode:'upstream_error';
 const limited=['usage_limit','rate_limit_exceeded','rate_limit','quota_exceeded'].includes(code);
 const message=limited?'Kết nối ChatGPT từ chối yêu cầu với mã ' + code + '. Phản hồi không kèm phần trăm còn lại hoặc thời điểm đặt lại; chưa đủ dữ liệu để kết luận tài khoản đã hết hạn mức. Bạn có thể thử Tự động; nút Mở demo vẫn hoạt động.':'ChatGPT báo lỗi xử lý phản hồi ('+code+'). Yêu cầu chưa được xác nhận hoàn thành.';
 throw Object.assign(Error(message),{code,statusCode:limited?429:502});
}

function extractMessageText(message: Record<string, unknown>): string {
  if(typeof message.content === "string")return message.content;
  const content = message.content as Record<string, unknown> | undefined;
  if (!content) return "";
  const parts = content.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    return parts.map((p) => typeof p === "string" ? p : p && typeof p === "object" && typeof p.text === "string" ? p.text : "").join("");
  }
  if (typeof content.text === "string") {
    return content.text;
  }
  return "";
}

function applyPatchOp(operation: Record<string, unknown>, currentText: string): string {
  const op = operation.o;
  const value = String(operation.v || "");
  if (op === "append") {
    return currentText + value;
  }
  if (op === "replace") {
    return value;
  }
  return currentText;
}

function applyTextPatch(event: Record<string, unknown>, currentText: string): string {
  if (event.p === "/message/content/parts" && Array.isArray(event.v))return extractMessageText({content:{parts:event.v}});
  if (event.p === "/message/content" && event.v && typeof event.v === "object")return extractMessageText({content:event.v});
  if (event.p === "/message" && event.v && typeof event.v === "object")return extractRawAssistantText({message:event.v},currentText);
  if (event.p === "/message/content/parts/0" || event.p === "/message/content/text") {
    return applyPatchOp(event, currentText);
  }

  const operations = event.v;
  if (typeof operations === "string" && currentText && !event.p && !event.o) {
    return currentText + operations;
  }

  if (Array.isArray(operations)) {
    let text = currentText;
    for (const item of operations) {
      if (item && typeof item === "object") {
        text = applyTextPatch(item as Record<string, unknown>, text);
      }
    }
    return text;
  }

  return currentText;
}

function extractRawAssistantText(event: Record<string, unknown>, currentText: string): string {
  const candidates = [event, event.v as Record<string, unknown> | undefined];
  for (const cand of candidates) {
    if (!cand || typeof cand !== "object") continue;
    const message = cand.message as Record<string, unknown> | undefined;
    if (!message || typeof message !== "object") continue;
    const author = message.author as Record<string, unknown> | undefined;
    if (author?.role === "assistant") {
      const text = extractMessageText(message);
      if (text) return text;
    }
  }
  return applyTextPatch(event, currentText);
}

export async function* streamConversationDeltas(
  backend: OpenAIBackendAPI,
  messages: ConversationMessage[],
  model = "auto"
): AsyncGenerator<string, void, unknown> {
  let fullRawText = "";
  let emittedText = "";

  for await (const payload of backend.streamConversation(messages, model)) {
    if (!payload) continue;
    if (payload === "[DONE]") break;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload);
    } catch {
      continue;
    }

    checkUpstreamError(event);
    const nextRawText = extractRawAssistantText(event, fullRawText);
    const nextCleanText = sanitizeOutputText(nextRawText);
    fullRawText = nextRawText;

    if (nextCleanText !== emittedText) {
      const delta = nextCleanText.startsWith(emittedText)
        ? nextCleanText.slice(emittedText.length)
        : nextCleanText;
      emittedText = nextCleanText;
      if (delta) {
        yield delta;
      }
    }
  }
}

export async function collectConversationText(
  backend: OpenAIBackendAPI,
  messages: ConversationMessage[],
  model = "auto"
): Promise<string> {
  let result = "";
  for await (const payload of backend.streamConversation(messages, model)) {
    if (!payload || payload === "[DONE]") continue;
    let event:Record<string,unknown>;
    try {event=JSON.parse(payload)}catch{continue;}
    checkUpstreamError(event);
    result=extractRawAssistantText(event,result);
  }
  return sanitizeOutputText(result);
}
