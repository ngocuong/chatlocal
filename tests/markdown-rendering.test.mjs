import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const md=createRequire(import.meta.url)('markdown-it');const html=fs.readFileSync('web/index.html','utf8');
const context=vm.createContext({markdownit:md});vm.runInContext(html.slice(html.indexOf('function normalizeAssistantText('),html.indexOf('function add(')),context);
const element={dataset:{}};context.element=element;vm.runInContext('renderAssistant(element,"**In đậm**\\n\\n- Mục một\\n\\n```js\\nconst x = 1;\\n```\\n<script>alert(1)</script>\\n\\n[bad](javascript:alert(1))")',context);
assert.match(element.innerHTML,/<strong>In đậm<\/strong>/);assert.match(element.innerHTML,/<ul>/);assert.match(element.innerHTML,/<pre><code/);assert.doesNotMatch(element.innerHTML,/<script>|href="javascript:/);assert.match(element.innerHTML,/&lt;script&gt;/);
vm.runInContext('renderAssistant(element,"![remote](https://example.com/tracking.png)")',context);assert.doesNotMatch(element.innerHTML,/<img/);
console.log('PASS: bold, lists and code render; raw HTML, unsafe links and external images do not execute/load');

const {default:Fastify}=await import('fastify');const {localRoutes}=await import('../dist/api/routes/local.route.js');const app=Fastify();await app.register(localRoutes);try{const r=await app.inject({url:'/local-markdown.js',headers:{host:'localhost:3040'}});assert.equal(r.statusCode,200);assert.match(r.headers['content-type'],/javascript/);assert.ok(r.body.length>10000);console.log('PASS: browser Markdown bundle is served by actual local route');}finally{await app.close();}

context.sample='**<text inline strong>Trùm mafia</text>** — mèo vest đen.\n\n1. **<text inline strong>CEO giàu có</text>**';vm.runInContext('renderAssistant(element,sample)',context);assert.match(element.innerHTML,/<strong>Trùm mafia<\/strong>/);assert.match(element.innerHTML,/<strong>CEO giàu có<\/strong>/);assert.doesNotMatch(element.innerHTML,/&lt;text|<text/);assert.doesNotMatch(element.dataset.rawText,/<text/);
vm.runInContext('renderAssistant(element,"`<text inline strong>ví dụ</text>`")',context);assert.match(element.innerHTML,/<code>&lt;text/);console.log('PASS: stray text/strong UI wrappers become Markdown bold in display and copy; code examples preserved');
context.sample='À đúng rồi 😅 Eun Nan-jo là nhân vật trong manhwa BL <Entity value="Borderline" category="artwork" disambig="manhwa BL của Danrim"/>, do Danrim sáng tác. <Cite refs={["turn149848search0","turn149848search5"]}/>\n\n<AsyncImageGroup query={["Borderline Danrim manhwa Eun Nan-jo character","Borderline cover"]} aspectRatio="3:4" layout="bento" size="lg"/>\n\n- **Chae Sun-hwa:** người khiến mối quan hệ rắc rối. <Cite refs={["turn149848search0"]}/>';
vm.runInContext('renderAssistant(element,sample)',context);assert.match(element.innerHTML,/Borderline/);assert.match(element.innerHTML,/Chae Sun-hwa/);assert.doesNotMatch(element.innerHTML,/Entity|Cite|AsyncImageGroup|turn149848|disambig|aspectRatio/);assert.doesNotMatch(element.dataset.rawText,/Entity|Cite|AsyncImageGroup|turn149848/);
context.sample='Ví dụ mã: `<Entity value="Borderline"/>`\n\n```jsx\n<Cite refs={["example"]}/>\n```';vm.runInContext('renderAssistant(element,sample)',context);assert.match(element.innerHTML,/&lt;Entity/);assert.match(element.innerHTML,/&lt;Cite/);console.log('PASS: screenshot Entity/Cite/AsyncImageGroup leaks cleaned from display and clipboard, names retained, literal code preserved');
context.sample='Giữ ảnh gốc.&#x20;\nMình sẽ chỉnh tiếp.&#32;';vm.runInContext('renderAssistant(element,sample)',context);assert.doesNotMatch(element.dataset.rawText,/&#x20;|&#32;/);context.sample='Mã ký tự: `&#x20;`';vm.runInContext('renderAssistant(element,sample)',context);assert.match(element.dataset.rawText,/`&#x20;`/);console.log('PASS: stray encoded spaces cleaned outside literal code');

context.sample=String.raw`Bạn chuyển sang **Ảnh và tài liệu → Tạo ảnh trên máy** rồi dùng prompt này:
\<WritingBlock id="58314" variant="standard">Eun Nanjo, black suit, two adult women, cinematic lighting.\</WritingBlock>`;vm.runInContext('renderAssistant(element,sample)',context);assert.doesNotMatch(element.innerHTML,/WritingBlock|58314|variant=/);assert.match(element.innerHTML,/<blockquote>/);assert.match(element.innerHTML,/Eun Nanjo/);assert.doesNotMatch(element.dataset.rawText,/WritingBlock/);context.sample='Ví dụ: `<WritingBlock id="123">text</WritingBlock>`';vm.runInContext('renderAssistant(element,sample)',context);assert.match(element.innerHTML,/&lt;WritingBlock/);console.log('PASS: escaped WritingBlock becomes readable prompt; clipboard clean; literal code examples preserved');
context.sample=String.raw`\<box gap={3}>\
\<row align=start gap={3}>\
\<icon name="code-2" size="xl"/>\
**Lập trình web/app quy mô lớn**
\`\`\`css
  Cần có kiến trúc rõ ràng, cơ sở dữ liệu và kiểm thử.
</box>

\`\`\`
\</row>\
\<divider color="subtle"/>\
\</box>` .replace(/\\`/g,'`');
vm.runInContext('renderAssistant(element,sample)',context);
assert.doesNotMatch(element.dataset.rawText,/<\/?(?:box|row|icon|divider)\b|```css|^\\$/m);
assert.match(element.innerHTML,/<strong>Lập trình/);assert.match(element.innerHTML,/Cần có kiến trúc/);assert.doesNotMatch(element.innerHTML,/<pre>/);
context.sample='```jsx\n<box gap={3}><row>Ví dụ</row></box>\n```\n\n```css\n.box { color: red; }\n```\n\n`<icon name="code"/>`';vm.runInContext('renderAssistant(element,sample)',context);assert.match(element.dataset.rawText,/<box gap=\{3\}>/);assert.match(element.dataset.rawText,/\.box \{ color: red; \}/);assert.match(element.dataset.rawText,/`<icon/);
console.log('PASS: leaked layout wrappers and malformed prose fences cleaned for display/copy; actual JSX/CSS/inline code preserved');
