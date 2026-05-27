const zlib = require('zlib');

const normalizeWhitespace = (value = '') => String(value)
  .replace(/\r/g, '\n')
  .replace(/\u0000/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

const decodePdfString = (raw = '') => {
  let output = '';

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = raw[index + 1];
    if (!next) break;

    if (next === 'n') {
      output += '\n';
      index += 1;
      continue;
    }

    if (next === 'r' || next === 't' || next === 'b' || next === 'f') {
      output += ' ';
      index += 1;
      continue;
    }

    if (/[0-7]/.test(next)) {
      const octal = raw.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] || next;
      output += String.fromCharCode(parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    output += next;
    index += 1;
  }

  return output;
};

const extractPdfText = (buffer) => {
  const latinText = buffer.toString('latin1');
  const collected = [];
  const literalPattern = /\((?:\\.|[^\\()]){3,}\)/g;
  const hexPattern = /<([0-9A-Fa-f\s]{8,})>/g;

  const literalMatches = latinText.match(literalPattern) || [];
  literalMatches.forEach((match) => {
    collected.push(decodePdfString(match.slice(1, -1)));
  });

  let hexMatch = hexPattern.exec(latinText);
  while (hexMatch) {
    const cleaned = hexMatch[1].replace(/\s+/g, '');
    if (cleaned.length % 2 === 0) {
      try {
        collected.push(Buffer.from(cleaned, 'hex').toString('utf8'));
      } catch (error) {
        // Ignore malformed hex strings and keep trying other matches.
      }
    }
    hexMatch = hexPattern.exec(latinText);
  }

  return normalizeWhitespace(collected.join('\n'));
};

const parseZipEntries = (buffer) => {
  const files = {};
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = buffer.toString('utf8', fileNameStart, fileNameEnd);
    const dataStart = fileNameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buffer.length) break;

    const fileBuffer = buffer.subarray(dataStart, dataEnd);
    if (compressionMethod === 0) {
      files[fileName] = fileBuffer;
    } else if (compressionMethod === 8) {
      try {
        files[fileName] = zlib.inflateRawSync(fileBuffer);
      } catch (error) {
        try {
          files[fileName] = zlib.inflateSync(fileBuffer);
        } catch (inflateError) {
          // Ignore malformed zip entries and continue.
        }
      }
    }

    offset = dataEnd;
  }

  return files;
};

const stripXml = (value = '') => normalizeWhitespace(
  value
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
);

const extractDocxText = (buffer) => {
  const entries = parseZipEntries(buffer);
  const xml = entries['word/document.xml'];
  if (!xml) return '';
  return stripXml(xml.toString('utf8'));
};

const extractLegacyDocText = (buffer) => {
  const binaryText = buffer.toString('latin1');
  const chunks = binaryText.match(/[A-Za-z0-9@:/+.,()\-_\s]{4,}/g) || [];
  return normalizeWhitespace(chunks.join(' '));
};

const extractResumeTextFromFile = async (file) => {
  if (!file?.buffer) {
    throw new Error('No file buffer provided for resume parsing');
  }

  const mimeType = file.mimetype || '';
  const extension = (file.originalname || '').toLowerCase();
  let text = '';
  let strategy = 'unknown';

  if (mimeType === 'application/pdf' || extension.endsWith('.pdf')) {
    text = extractPdfText(file.buffer);
    strategy = 'pdf-heuristic';
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || extension.endsWith('.docx')
  ) {
    text = extractDocxText(file.buffer);
    strategy = 'docx-xml';
  } else if (
    mimeType === 'application/msword'
    || extension.endsWith('.doc')
  ) {
    text = extractLegacyDocText(file.buffer);
    strategy = 'doc-binary';
  } else {
    throw new Error('Unsupported resume file type');
  }

  const normalizedText = normalizeWhitespace(text);
  const textLength = normalizedText.length;

  if (!normalizedText) {
    return {
      text: '',
      strategy,
      status: 'needs_review',
      warning: 'Could not extract readable text from this file. It may be scanned or image-based.'
    };
  }

  return {
    text: normalizedText,
    strategy,
    status: textLength >= 25 ? 'parsed' : 'needs_review',
    warning: textLength >= 25 ? '' : 'Only a small amount of text could be extracted. Please review the result.'
  };
};

module.exports = {
  normalizeWhitespace,
  extractResumeTextFromFile
};
