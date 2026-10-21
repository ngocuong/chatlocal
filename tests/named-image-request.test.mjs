import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync('web/index.html','utf8'),start=html.indexOf('function requestedImageModel('),end=html.indexOf("document.querySelector('#form').onsubmit=",start),context=vm.createContext({});vm.runInContext(html.slice(start,end),context);
for(const text of ['Dùng Flux tạo ảnh một con mèo','Dùng Flux vẽ một người trên biển','Sử dụng Flux để chỉnh ảnh vừa gửi','Vẽ ảnh bằng Flux.2 Klein 4B Q8'])assert.equal(context.requestedImageModel(text),'flux2-klein-4b-q8',text);
assert.equal(context.requestedImageModel('Dùng Turbo Q8 tạo ảnh một con mèo'),'z-image-turbo-q8');assert.equal(context.requestedImageModel('Dùng Z-Image-Turbo Q8 vẽ một con mèo'),'z-image-turbo-q8');assert.equal(context.requestedImageModel('Dùng Qwen chỉnh ảnh này'),null);
for(const text of ['Flux có mạnh hơn không?','Đừng dùng Flux tạo ảnh','Giải thích cách dùng Flux tạo ảnh','So sánh Qwen với Flux'])assert.equal(context.requestedImageModel(text),null,text);
console.log('PASS: explicit named image actions select model and route Work; questions/comparisons/negations do not trigger actions');

for(const text of ['Dùng Turbo và tạo ảnh 1 người nam mặc áo xanh, quần đen, đeo kính đen cool ngầu, ngồi ghế bố, có thêm cây dù che nắng, có con chó bigpull ngồi kế bên, view là biển bãi sau vũng tàu, đằng sau là núi chúa','Dùng Turbo tạo ảnh một con mèo','Sài Turbo để vẽ một người','Tạo ảnh bằng Turbo','Dùng Turbo Q8 và tạo ảnh một con mèo'])assert.equal(context.requestedImageModel(text),'z-image-turbo-q8',text);
for(const text of ['Turbo có mạnh hơn Flux không?','Đừng dùng Turbo tạo ảnh','Giải thích cách dùng Turbo tạo ảnh'])assert.equal(context.requestedImageModel(text),null,text);

for(const text of ['turbo tạo ảnh người ngồi trên biển','tao muốn dùng turbo gen ảnh một người','tạo cho tao ảnh con mèo bằng turbo','Turbo: một con mèo bên biển'])assert.equal(context.requestedImageModel(text),'z-image-turbo-q8',text);
for(const text of ['flux chỉnh ảnh này','tao muốn flux đổi nền ảnh','gen ảnh con mèo với flux'])assert.equal(context.requestedImageModel(text),'flux2-klein-4b-q8',text);
assert.equal(context.requestedImageModel('Dùng turbo hoặc flux tạo ảnh'),'ambiguous');
