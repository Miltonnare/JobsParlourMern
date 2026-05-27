const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractJsonObject,
  buildRegexStructuredResumeData,
  structureResumeText
} = require('../utils/ocr');

test('extractJsonObject parses fenced JSON from Groq-style responses', () => {
  const parsed = extractJsonObject('```json\n{"name":"Ada","skills":["Node","React"]}\n```');

  assert.equal(parsed.name, 'Ada');
  assert.deepEqual(parsed.skills, ['Node', 'React']);
});

test('buildRegexStructuredResumeData structures resume content from regex fallback', () => {
  const structured = buildRegexStructuredResumeData(`
    Grace Hopper
    grace@example.com
    https://github.com/grace

    Skills:
    React, Node, MongoDB

    Education:
    BSc Computer Science

    Experience:
    Built hiring dashboards and APIs.
  `);

  assert.equal(structured.name, 'Grace Hopper');
  assert.ok(structured.emails.includes('grace@example.com'));
  assert.ok(structured.links.some((link) => link.includes('github.com/grace')));
  assert.ok(structured.skills.includes('react'));
  assert.match(structured.education, /BSc Computer Science/);
  assert.match(structured.experience, /Built hiring dashboards/);
  assert.equal(structured.parser, 'regex-fallback');
});

test('structureResumeText uses Groq structured output when available', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            name: 'Ada Lovelace',
            emails: ['ada@example.com'],
            phones: ['+123456789'],
            links: ['https://linkedin.com/in/ada'],
            skills: ['Algorithms', 'Mathematics'],
            summary: 'Pioneer programmer',
            education: 'Self-directed study',
            experience: 'Analytical engine notes'
          })
        }
      }]
    })
  });

  try {
    const structured = await structureResumeText('Ada resume text', { apiKey: 'test-key' });

    assert.equal(structured.name, 'Ada Lovelace');
    assert.deepEqual(structured.skills, ['algorithms', 'mathematics']);
    assert.equal(structured.fallbackUsed, false);
    assert.equal(structured.parser, 'groq');
  } finally {
    global.fetch = originalFetch;
  }
});

test('structureResumeText falls back to regex when Groq fails', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };

  try {
    const structured = await structureResumeText(`
      Grace Hopper
      grace@example.com
      Skills:
      React, Node
    `, { apiKey: 'test-key' });

    assert.equal(structured.fallbackUsed, true);
    assert.equal(structured.parser, 'regex-fallback');
    assert.match(structured.fallbackReason, /network down/);
    assert.ok(structured.skills.includes('react'));
  } finally {
    global.fetch = originalFetch;
  }
});
