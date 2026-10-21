import assert from 'node:assert/strict';import {imageStepProgress} from '../dist/services/image-progress.service.js';
assert.equal(imageStepProgress('Loading weights 2/5'),undefined);assert.equal(imageStepProgress('Loading shards: 100%|████| 4/4'),undefined);
assert.match(imageStepProgress('\r 33%|███       | 3/9 [00:10<00:20]'),/33%.*3\/9/);
assert.match(imageStepProgress('\r 33%|███| 3/9\r 67%|██████| 6/9'),/67%.*6\/9/);
assert.match(imageStepProgress('\r100%|██████████| 9/9'),/giải mã và lưu ảnh/);
assert.equal(imageStepProgress('\r100%|██| 11/9'),undefined);
console.log('PASS: actual step counts produce percentages; loading has no invented percent; 100% steps still reports decoding/saving');
