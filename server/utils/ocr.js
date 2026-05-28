const extractJsonObject = (content = '') => {
  const fencedMatch = String(content).match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : content;
  return JSON.parse(candidate.trim());
};

const dedupeLower = (items = []) => [...new Set(items.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];

const buildRegexStructuredResumeData = (resumeText = '') => {
  const text = String(resumeText).trim();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phones = text.match(/(?:\+?\d[\d\s-]{7,}\d)/g) || [];
  const links = text.match(/https?:\/\/[^\s)]+/gi) || [];
  const skillsMatch = text.match(/skills?\s*:?\s*([\s\S]*?)(?:education|experience|summary|projects|$)/i);
  const educationMatch = text.match(/education\s*:?\s*([\s\S]*?)(?:experience|summary|projects|skills|$)/i);
  const experienceMatch = text.match(/experience\s*:?\s*([\s\S]*?)(?:education|summary|projects|skills|$)/i);

  return {
    name: lines[0] || '',
    emails: dedupeLower(emails),
    phones: dedupeLower(phones),
    links: dedupeLower(links),
    skills: dedupeLower((skillsMatch?.[1] || '').split(/[\n,|]/g)),
    summary: '',
    education: (educationMatch?.[1] || '').trim(),
    experience: (experienceMatch?.[1] || '').trim(),
    parser: 'regex-fallback',
    fallbackUsed: true
  };
};

const structureResumeText = async (resumeText = '', options = {}) => {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  const model = options.model || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  const fallback = buildRegexStructuredResumeData(resumeText);

  if (!apiKey) {
    return {
      ...fallback,
      fallbackReason: 'GROQ_API_KEY is not configured'
    };
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: 'Extract resume details and return strict JSON with keys: name, emails, phones, links, skills, summary, education, experience.'
          },
          {
            role: 'user',
            content: resumeText
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || '{}';
    const parsed = extractJsonObject(content);

    return {
      name: parsed.name || '',
      emails: dedupeLower(parsed.emails || []),
      phones: dedupeLower(parsed.phones || []),
      links: dedupeLower(parsed.links || []),
      skills: dedupeLower(parsed.skills || []),
      summary: parsed.summary || '',
      education: parsed.education || '',
      experience: parsed.experience || '',
      parser: 'groq',
      fallbackUsed: false
    };
  } catch (error) {
    return {
      ...fallback,
      fallbackReason: error.message || 'Groq structuring failed'
    };
  }
};

module.exports = {
  extractJsonObject,
  buildRegexStructuredResumeData,
  structureResumeText
};
