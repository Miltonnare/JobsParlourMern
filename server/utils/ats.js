const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { parseResumeText } = require('./profileInsights');

const execFileAsync = promisify(execFile);

const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const normalizeWhitespace = (value = '') => String(value)
  .replace(/\r/g, '\n')
  .replace(/\u0000/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

const extractJsonObject = (value = '') => {
  const text = String(value || '').trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in Groq response');
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
};

const toArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[,|\n]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const extractSection = (text, sectionName) => {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`${escaped}\\s*:?[ \\t]*\\n?([\\s\\S]*?)(?=\\n[A-Z][A-Za-z ]{2,}:|$)`, 'i'));
  return match?.[1]?.trim() || '';
};

const buildRegexStructuredResumeData = (rawText = '') => {
  const text = normalizeWhitespace(rawText);
  const parsed = parseResumeText(text);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const name = lines[0] || '';
  const education = extractSection(text, 'Education');
  const experience = extractSection(text, 'Experience') || extractSection(text, 'Work Experience');
  const skillsSection = extractSection(text, 'Skills');
  const skills = unique([
    ...parsed.skills,
    ...toArray(skillsSection)
  ]);

  return {
    name,
    emails: parsed.emails || [],
    phones: parsed.phones || [],
    links: parsed.links || [],
    skills,
    summary: parsed.summary || '',
    education,
    experience,
    rawText: text,
    parser: 'regex-fallback'
  };
};

const normalizeStructuredResumeData = (raw = {}, rawText = '', parser = 'groq') => ({
  name: typeof raw.name === 'string' ? raw.name.trim() : '',
  emails: unique(toArray(raw.emails)),
  phones: unique(toArray(raw.phones)),
  links: unique(toArray(raw.links)),
  skills: unique(toArray(raw.skills).map((skill) => skill.toLowerCase())),
  summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
  education: typeof raw.education === 'string' ? raw.education.trim() : '',
  experience: typeof raw.experience === 'string' ? raw.experience.trim() : '',
  rawText: normalizeWhitespace(raw.rawText || rawText),
  parser
});

const structureResumeTextWithGroq = async (resumeText = '', options = {}) => {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const normalizedText = normalizeWhitespace(resumeText);
  if (!normalizedText) {
    throw new Error('Resume text is required for Groq structuring');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Extract resume information and return strict JSON only with keys: name, emails, phones, links, skills, summary, education, experience.'
        },
        {
          role: 'user',
          content: `Resume text:\n${normalizedText}`
        }
      ]
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || 'Groq request failed');
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq response did not contain structured content');
  }

  return normalizeStructuredResumeData(extractJsonObject(content), normalizedText, 'groq');
};

const structureResumeText = async (resumeText = '', options = {}) => {
  const fallback = buildRegexStructuredResumeData(resumeText);

  try {
    const structured = await structureResumeTextWithGroq(resumeText, options);
    return {
      ...structured,
      fallbackUsed: false
    };
  } catch (error) {
    return {
      ...fallback,
      fallbackUsed: true,
      fallbackReason: error.message
    };
  }
};

const extractTextWithTesseract = async (input, options = {}) => {
  const language = options.language || 'eng';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jobsparlour-ocr-'));
  const extension = path.extname(input.originalname || '') || '.png';
  const inputPath = path.join(tempDir, `source${extension}`);

  try {
    if (input?.buffer) {
      await fs.writeFile(inputPath, input.buffer);
    } else if (input?.path) {
      await fs.copyFile(input.path, inputPath);
    } else {
      throw new Error('OCR input must include a buffer or file path');
    }

    const { stdout } = await execFileAsync('tesseract', [inputPath, 'stdout', '-l', language], {
      maxBuffer: 10 * 1024 * 1024
    });

    return normalizeWhitespace(stdout);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const extractStructuredDataFromImage = async (input, options = {}) => {
  const extractedText = await extractTextWithTesseract(input, options);
  const structured = await structureResumeText(extractedText, options);

  return {
    extractedText,
    structuredData: structured
  };
};

module.exports = {
  extractJsonObject,
  buildRegexStructuredResumeData,
  structureResumeTextWithGroq,
  structureResumeText,
  extractTextWithTesseract,
  extractStructuredDataFromImage
};
