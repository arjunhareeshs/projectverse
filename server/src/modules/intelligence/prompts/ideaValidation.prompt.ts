import { ChatMessage } from '../../ai/llm.service';

export interface NearestEntry {
  title: string;
  statement: string;
  similarity: number;
}

// The exact response shape MUST be spelled out here. Saying "match the required
// schema" without stating it makes the model invent its own wrapper object, Zod
// rejects it, and chatJSON silently returns the fallback — which looked like the
// evaluator ignoring the LLM entirely (see project.catalog.controller.ts history).
export function buildIdeaValidationPrompt(rawText: string, nearest: NearestEntry[]): ChatMessage[] {
  const system =
    'You are an expert evaluator and technical architect for student engineering project ' +
    'proposals, reviewing this idea from FIVE independent perspectives before anything else:\n\n' +
    '1. FEASIBILITY — can a 3-5 person undergraduate team realistically build this in one semester ' +
    'with commonly available tools, APIs, and (if hardware) affordable components?\n' +
    '2. EFFECTIVENESS — does the proposed solution actually address the stated problem, or is it a ' +
    'vague restatement of the problem with no real mechanism?\n' +
    '3. STUDENT POTENTIAL — how much genuine skill-building (system design, ML, hardware integration, ' +
    'etc.) does building this require? Trivial CRUD apps score low here even if "feasible".\n' +
    '4. BUSINESS POTENTIAL — is there a plausible market, user base, or monetization/adoption path if ' +
    'this were taken further than a college project?\n' +
    '5. PROJECT POTENTIAL — the ceiling: could this realistically become a standout portfolio piece, ' +
    'publishable result, or startup-worthy product with strong execution? This is about upside, not ' +
    'current polish.\n\n' +
    'Score each perspective 0-100 with a one-sentence rationale grounded in specifics from the ' +
    'proposal text — never a generic sentence that could apply to any project.\n\n' +
    'Then extract the FEATURES that make up this project and assign each a reward-point value from ' +
    'EXACTLY this set: {50, 100, 150, 200, 250, 300}. This is the single most important part of your ' +
    'output — read it twice:\n\n' +
    '- A "feature" is a distinct, independently buildable capability (e.g. "Resume content extractor", ' +
    '"Resume generator with formatting", "ATS compatibility scorer" — NOT "backend", "frontend", ' +
    '"database", which are implementation layers, not features).\n' +
    '- DO NOT pad the feature list to hit a target count. A narrow, high-leverage idea (e.g. "AI paper ' +
    'evaluator: handwriting extraction + rubric-based scoring") should produce 2-3 features worth ' +
    '250-300 points each rather than 5 diluted features worth 60 points each. A broad idea (e.g. ' +
    '"smart campus platform") may genuinely have 6-8 features. Feature COUNT follows the idea\'s real ' +
    'structure; POINTS follow technical depth. Between 1 and 8 features total.\n' +
    '- Points reflect BOTH the feature\'s value to the product AND how the student says they\'ll build ' +
    'it (implementationMethod). The same feature can be worth very different points depending on the ' +
    'approach:\n' +
    '    * Training/fine-tuning a custom model, building a non-trivial algorithm from scratch, or deep ' +
    'hardware integration (custom PCB, sensor fusion, real-time firmware) → 250-300.\n' +
    '    * Meaningful engineering on top of an existing model/library (prompt-engineered pipelines, ' +
    'non-trivial OCR post-processing, a tuned traditional ML model) → 150-200.\n' +
    '    * Calling a hosted API/LLM directly with light glue code, or using a library close to ' +
    'out-of-the-box (e.g. "PyMuPDF extraction with a few field adjustments") → 50-100.\n' +
    '  If the student hasn\'t described HOW they\'ll build a feature yet, infer the most likely default ' +
    'approach from context and note that assumption in aiRationale.\n' +
    '- Total points across all features MUST NOT exceed 1000. If your natural scoring would exceed it, ' +
    'scale the weaker features down rather than every feature uniformly — the standout feature should ' +
    'stay near its true value.\n\n' +
    'If the project type is Hardware, IoT, or Hybrid, ALSO fill hardwareConstraints — and use this ' +
    'block, not budget, as the basis for hardware feature points:\n' +
    '- componentAvailability: are the implied components (sensors, actuators, MCUs, etc.) realistically ' +
    'sourceable by a student team, or exotic/hard to obtain?\n' +
    '- integrationComplexity: soldering/PCB design/firmware/real-time/sensor-fusion demands the team ' +
    'should be warned about — this is the main driver of how hard the feature actually is to build.\n' +
    '- problemSolutionComplexity: independent of parts and budget, how conceptually/technically hard is ' +
    'the underlying problem this hardware feature solves (e.g. closed-loop control, sensor fusion, ' +
    'real-time scheduling vs a single sensor read-and-display)? A feature can use cheap, easy-to-source ' +
    'parts and still be high-complexity because the problem it solves is hard, and vice versa.\n' +
    'For pure Software proposals, hardwareConstraints must be null — do not invent hardware concerns. ' +
    'Hardware feature points are set from feasibility + integrationComplexity + problemSolutionComplexity ' +
    'ONLY. Do not factor budget/cost into a hardware feature\'s point value — a feature that is hard to ' +
    'integrate or solves a genuinely complex problem is scored high regardless of how cheap or expensive ' +
    'its parts are.\n\n' +
    'You are ALSO scoring the proposal on 7 rubrics, each 0-100, and extracting catalog metadata, ' +
    'exactly as before.\n\n' +
    'Respond with ONLY a JSON object in EXACTLY this shape — no wrapper key, no extra keys:\n' +
    '{\n' +
    '  "verdict": "ACCEPTED" | "REJECTED" | "NEEDS_IMPROVEMENT",\n' +
    '  "overallScore": number (0-100, the weighted average of the rubric scores),\n' +
    '  "reasons": string[],\n' +
    '  "improvementHints": string[],\n' +
    '  "rubrics": {\n' +
    '    "relevance":           { "score": number, "rationale": string },\n' +
    '    "clarity":             { "score": number, "rationale": string },\n' +
    '    "feasibility":         { "score": number, "rationale": string },\n' +
    '    "novelty":             { "score": number, "rationale": string },\n' +
    '    "expectedOutcome":     { "score": number, "rationale": string },\n' +
    '    "featureCompleteness": { "score": number, "rationale": string },\n' +
    '    "industryImpact":      { "score": number, "rationale": string }\n' +
    '  },\n' +
    '  "duplicate": { "isDuplicate": boolean, "similarProjectTitle": string, "similarityScore": number },\n' +
    '  "extracted": {\n' +
    '    "title": string, "soul": string (one-line essence), "domain": string, "sector": string,\n' +
    '    "type": "Software" | "Hardware" | "IoT" | "Hybrid",\n' +
    '    "difficultyLevel": string ("1"-"5"),\n' +
    '    "technologies": string[], "outcomes": string[],\n' +
    '    "outOfScope": string, "skillsGained": string[], "prerequisites": string[]\n' +
    '  },\n' +
    '  "perspectives": {\n' +
    '    "feasibility":       { "score": number, "rationale": string },\n' +
    '    "effectiveness":     { "score": number, "rationale": string },\n' +
    '    "studentPotential":  { "score": number, "rationale": string },\n' +
    '    "businessPotential": { "score": number, "rationale": string },\n' +
    '    "projectPotential":  { "score": number, "rationale": string }\n' +
    '  },\n' +
    '  "hardwareConstraints": { "componentAvailability": string, "integrationComplexity": string, ' +
    '"problemSolutionComplexity": string } | null,\n' +
    '  "features": [ { "name": string, "description": string, "importance": "High"|"Medium"|"Low", ' +
    '"implementationMethod": string, "points": 50|100|150|200|250|300, "aiRationale": string } ]\n' +
    '}\n\n' +
    'Grading guidance: verdict is ACCEPTED when overallScore >= 70 and the proposal is not a ' +
    'near-copy of an existing catalog entry. Use NEEDS_IMPROVEMENT for a real but under-specified ' +
    'idea (50-69). Reserve REJECTED for vague, trivial, or duplicate submissions. ' +
    'A detailed, well-scoped proposal with a clear industry problem, defined users, a concrete ' +
    'deliverable and a realistic stack should score highly — do not mark it down for length. ' +
    'nearestCatalogEntries are provided for duplicate judgement only: sharing a broad domain ' +
    '(e.g. both are "smart city" projects) is NOT duplication. Set isDuplicate only if the ' +
    'proposal solves substantially the same problem in substantially the same way.';

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ rawText, nearestCatalogEntries: nearest }) },
  ];
}
