// Simple heuristics to detect Indian laws and clause categories in chunk text
const LAW_PATTERNS = [
  { name: 'Indian Contract Act, 1872', patterns: [/Indian Contract Act/i, /Contract Act/i] },
  { name: 'Information Technology Act, 2000', patterns: [/Information Technology Act/i, /IT Act/i] },
  { name: 'Indian Penal Code', patterns: [/Indian Penal Code/i, /IPC/i] },
  { name: 'Specific Relief Act, 1963', patterns: [/Specific Relief Act/i] },
  { name: 'Arbitration and Conciliation Act, 1996', patterns: [/Arbitration and Conciliation Act/i, /arbitration/i] },
  { name: 'Consumer Protection Act, 2019', patterns: [/Consumer Protection Act/i, /consumer/i] },
];

const CLAUSE_PATTERNS = [
  { category: 'payment', patterns: [/payment/i, /consideration/i, /fees?/i, /price/i] },
  { category: 'termination', patterns: [/terminate/i, /termination/i, /rescission/i, /expiry/i] },
  { category: 'liability', patterns: [/liabilit/i, /liability/i, /liable/i] },
  { category: 'ip', patterns: [/intellectual property/i, /copyright/i, /trademark/i, /patent/i, /IP/i] },
  { category: 'confidentiality', patterns: [/confidential/i, /non-?disclosure/i, /NDA/i] },
  { category: 'indemnity', patterns: [/indemnif/i, /indemnity/i] },
  { category: 'limitation of liability', patterns: [/limit of liability/i, /limitation/i] },
  { category: 'dispute resolution', patterns: [/dispute/i, /jurisdiction/i, /governing law/i, /arbitrat/i] },
  { category: 'assignment', patterns: [/assign/i, /assignment/i] },
  { category: 'penalty', patterns: [/penalt/i, /liquidated damages/i, /ld/i] },
];

export function extractLegalReferences(text) {
  const found = { laws: [], clauses: [] };
  if (!text || typeof text !== 'string') return found;

  // Laws
  for (const law of LAW_PATTERNS) {
    for (const p of law.patterns) {
      if (p.test(text)) {
        found.laws.push(law.name);
        break;
      }
    }
  }

  // Clauses/categories with small snippets
  for (const c of CLAUSE_PATTERNS) {
    for (const p of c.patterns) {
      const m = text.match(p);
      if (m) {
        const snippet = extractSnippet(text, m.index, 120);
        found.clauses.push({ category: c.category, snippet });
        break;
      }
    }
  }

  // Deduplicate
  found.laws = Array.from(new Set(found.laws));
  found.clauses = found.clauses.reduce((acc, cur) => {
    if (!acc.some((a) => a.category === cur.category)) acc.push(cur);
    return acc;
  }, []);

  return found;
}

function extractSnippet(text, index, len = 120) {
  const start = Math.max(0, index - Math.floor(len / 2));
  const end = Math.min(text.length, start + len);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function aggregateReferences(results) {
  const agg = { laws: {}, clauses: {} };
  results.forEach((res, idx) => {
    const refs = extractLegalReferences(res.text || '');
    refs.laws.forEach((l) => { agg.laws[l] = agg.laws[l] || []; agg.laws[l].push({ source: res.source, chunk: idx + 1 }); });
    refs.clauses.forEach((c) => { agg.clauses[c.category] = agg.clauses[c.category] || []; agg.clauses[c.category].push({ snippet: c.snippet, source: res.source, chunk: idx + 1 }); });
  });
  return agg;
}

export function perChunkReferences(results) {
  // returns array of same length as results with detected laws and clauses for each chunk
  return results.map((res) => {
    const refs = extractLegalReferences(res.text || '');
    return { laws: refs.laws, clauses: refs.clauses };
  });
}