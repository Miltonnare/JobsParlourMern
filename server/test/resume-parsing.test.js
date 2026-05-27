const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const User = require('../models/userModel');
const { extractResumeTextFromFile } = require('../utils/resumeParsing');

const buildDocxBuffer = (xml) => {
  const fileName = 'word/document.xml';
  const compressed = zlib.deflateRawSync(Buffer.from(xml, 'utf8'));
  const header = Buffer.alloc(30 + Buffer.byteLength(fileName));

  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(Buffer.byteLength(xml), 22);
  header.writeUInt16LE(Buffer.byteLength(fileName), 26);
  header.writeUInt16LE(0, 28);
  header.write(fileName, 30, 'utf8');

  return Buffer.concat([header, compressed]);
};

test('resume parser extracts readable text from PDF-like files', async () => {
  const file = {
    mimetype: 'application/pdf',
    originalname: 'resume.pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n(Grace Hopper)\n(grace@example.com)\n(React Node MongoDB engineer)\n', 'latin1')
  };

  const parsed = await extractResumeTextFromFile(file);

  assert.equal(parsed.status, 'parsed');
  assert.match(parsed.text, /Grace Hopper/);
  assert.match(parsed.text, /grace@example\.com/);
  assert.match(parsed.text, /React Node MongoDB engineer/);
});

test('resume parser extracts readable text from DOCX files', async () => {
  const file = {
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    originalname: 'resume.docx',
    buffer: buildDocxBuffer('<w:document><w:body><w:p><w:r><w:t>Ada Lovelace</w:t></w:r></w:p><w:p><w:r><w:t>ada@example.com</w:t></w:r></w:p></w:body></w:document>')
  };

  const parsed = await extractResumeTextFromFile(file);

  assert.equal(parsed.status, 'parsed');
  assert.match(parsed.text, /Ada Lovelace/);
  assert.match(parsed.text, /ada@example\.com/);
});

test('resume parser falls back to needs_review when almost no text is found', async () => {
  const file = {
    mimetype: 'application/pdf',
    originalname: 'scanned.pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n(Hi)\n', 'latin1')
  };

  const parsed = await extractResumeTextFromFile(file);

  assert.equal(parsed.status, 'needs_review');
  assert.match(parsed.warning, /review|extract/i);
});

test('user model stores resume parsing metadata', () => {
  const user = new User({
    name: 'Grace',
    email: 'grace@example.com',
    password: 'hashed-password',
    role: 'jobseeker',
    resumeParsing: {
      status: 'parsed',
      sourceFileName: 'resume.pdf',
      mimeType: 'application/pdf',
      extractedCharacters: 512,
      lastAttemptedAt: new Date()
    }
  });

  assert.equal(user.resumeParsing.status, 'parsed');
  assert.equal(user.resumeParsing.sourceFileName, 'resume.pdf');
  assert.equal(user.resumeParsing.extractedCharacters, 512);
  assert.equal(user.validateSync(), undefined);
});
