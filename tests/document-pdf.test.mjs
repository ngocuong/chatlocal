import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,extractDocument} from '../dist/services/document-files.service.js';
test('pdf documents render sections, Vietnamese text and tables',async()=>{
 const buffer=await createDocument({format:'pdf',title:'Báo cáo thử nghiệm',sections:[{heading:'Phân tích SWOT',paragraphs:['Điểm mạnh của đối thủ.'],bullets:['Mạng lưới bác sĩ'],table:[['Tiêu chí','Điểm'],['Giá','8']]}]});
 assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
 const text=await extractDocument('a.pdf',buffer);
 for(const expected of ['Báo cáo thử nghiệm','Phân tích SWOT','Mạng lưới bác sĩ','Tiêu chí'])assert.ok(text.normalize('NFC').includes(expected),expected);
});
test('docx documents use the styled layout',async()=>{
 const AdmZip=(await import('adm-zip')).default;
 const buffer=await createDocument({format:'docx',title:'Báo cáo',sections:[{heading:'SWOT',table:[['A','B'],['1','2']]}]});
 const zip=new AdmZip(buffer),xml=zip.readAsText('word/document.xml');
 assert.ok(xml.includes('w:fill="1E3A8A"'));assert.ok(xml.includes('<w:tblLayout w:type="fixed"/>'));
 assert.match(zip.getEntries().filter(e=>/footer/.test(e.entryName)).map(e=>zip.readAsText(e)).join(''),/NUMPAGES/);
});
