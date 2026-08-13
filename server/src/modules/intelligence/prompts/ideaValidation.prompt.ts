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
//
// overallScore in the response is READ ONLY for context — ideaIntelligence.service
// recomputes it deterministically from the rubric/industryRubric scores and never
// trusts the model's own arithmetic. Likewise hardFeasibilityBlocker is enforced
// server-side: if blocked is true the verdict is forced to REJECTED regardless of
// score. Call this with temperature 0 — the whole point of a rubric-scored gate is
// that the same proposal text produces the same verdict every time.
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
    'DISCIPLINE-SPECIFIC CONSTRAINT CHECKING — determine the engineering discipline from the ' +
    'proposal\'s domain/sector/type (not from a fixed list you output), and apply the matching checklist ' +
    'below when filling hardwareConstraints or softwareRigor:\n' +
    '- Software: architecture clarity, data model/API feasibility, security & privacy handling, a real ' +
    'testing plan, deployment feasibility. Actively down-score proposals that are a thin CRUD app dressed ' +
    'up in project language — say so plainly in trivialCrudRisk rather than being polite about it.\n' +
    '- Electrical / Electronics / IoT hardware: component availability to a student in a normal market, ' +
    'realistic budget for the stated scope, power draw and electrical safety, sensor/actuator integration ' +
    'complexity, and whether the number/value of I/O the student promises is realistic at their budget.\n' +
    '- Mechanical: fabrication feasibility (can a student machine shop / 3D printer / vendor actually ' +
    'make this), material availability, tolerance and assembly complexity, mechanical safety, maintenance, ' +
    'and how they plan to test/validate the physical build.\n' +
    '- Mechatronics: everything mechanical AND electrical above, PLUS mechanical-electrical-software ' +
    'integration risk, control-loop feasibility, calibration effort, real-time constraints, and failure ' +
    'handling (what happens when a sensor drops out or an actuator jams).\n' +
    '- Automobile: safety and regulatory awareness (this is not optional for anything vehicle-adjacent), ' +
    'sensor/diagnostic feasibility, how they integrate with or simulate the vehicle without full factory ' +
    'access, testability without a real vehicle, and cost/durability of any physical add-on.\n' +
    '- Agriculture: field deployability (dust, water, sun, power access), robustness to weather/soil ' +
    'variability, usability by a non-technical farmer, low-cost maintenance, and whether the promised ' +
    'yield/water/labor impact is actually measurable with what they\'re building.\n' +
    '- Biotech: lab feasibility with equipment a student can access, biosafety and ethics (never wave ' +
    'this away), a concrete non-clinical validation method, reagent/equipment availability, and whether ' +
    'any clinical or diagnostic claim is appropriately scoped down for a student project.\n\n' +
    'For a Software-type proposal, fill softwareRigor and set hardwareConstraints to null. For Hardware, ' +
    'IoT, or Hybrid, fill hardwareConstraints (using the matching discipline checklist above for its ' +
    'four text fields — componentAvailability, integrationComplexity, problemSolutionComplexity, ' +
    'budgetRealism, safetyRisk) and set softwareRigor to null. Never invent hardware concerns for a pure ' +
    'software proposal, and never invent software-architecture concerns for a pure hardware proposal. ' +
    'Hardware feature points are driven by feasibility + integrationComplexity + problemSolutionComplexity ' +
    'ONLY — do not factor budget/cost into a hardware feature\'s point value; a feature that is hard to ' +
    'integrate or solves a genuinely complex problem scores high regardless of how cheap or expensive its ' +
    'parts are. budgetRealism and safetyRisk inform hardFeasibilityBlocker, not feature points.\n\n' +
    'HARD FEASIBILITY BLOCKER — set hardFeasibilityBlocker.blocked = true (with a one-sentence reason) ' +
    'ONLY for a genuine dealbreaker a strong score elsewhere cannot excuse: unsafe for a student to build ' +
    'as described (e.g. high-voltage/high-current work with no isolation plan, a biosafety violation), ' +
    'requires access/approval a student team realistically cannot obtain (e.g. full vehicle CAN bus access, ' +
    'a hospital IRB, a clinical trial), or a budget/component requirement that is impossible at the scale ' +
    'described (e.g. promising 20 precision actuators on a "low-cost" budget with no path to affording ' +
    'them). Do NOT set this for ordinary difficulty, ambition, or "this is hard" — it exists for proposals ' +
    'that cannot be built as described, not proposals that are merely challenging.\n\n' +
    'You are ALSO scoring the proposal on 7 core rubrics AND 7 industry-standard rubrics, each 0-100, and ' +
    'extracting catalog metadata, exactly as before:\n' +
    '- Core rubrics (unchanged): relevance, clarity, feasibility, novelty, expectedOutcome, ' +
    'featureCompleteness, industryImpact.\n' +
    '- Industry rubrics (new — score these as rigorously as the core ones, not as an afterthought):\n' +
    '    * implementationDepth — how much real engineering work this actually requires vs. gluing ' +
    'together existing tools with no original work.\n' +
    '    * userValue — would a real target user actually want and use the finished thing.\n' +
    '    * scalabilityOrDeployability — could this run for more than a demo (more users, more data, real ' +
    'field conditions) without a rewrite.\n' +
    '    * safetyAndRisk — physical, data, or financial risk the finished thing could pose if used as ' +
    'intended (this is broader than hardFeasibilityBlocker — most proposals score fine here even with no ' +
    'blocker).\n' +
    '    * maintainability — could someone other than the original team understand and extend this.\n' +
    '    * costRealism — is the described budget/resource plan realistic for a student team, whether or ' +
    'not hardware is involved.\n' +
    '    * testingAndValidation — is there a credible plan to verify the thing actually works, not just ' +
    'that it runs.\n\n' +
    'Respond with ONLY a JSON object in EXACTLY this shape — no wrapper key, no extra keys:\n' +
    '{\n' +
    '  "verdict": "ACCEPTED" | "REJECTED" | "NEEDS_IMPROVEMENT",\n' +
    '  "overallScore": number (0-100, your best-effort weighted average — the backend recomputes this ' +
    'deterministically, so this value is advisory only),\n' +
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
    '  "industryRubrics": {\n' +
    '    "implementationDepth":         { "score": number, "rationale": string },\n' +
    '    "userValue":                   { "score": number, "rationale": string },\n' +
    '    "scalabilityOrDeployability":  { "score": number, "rationale": string },\n' +
    '    "safetyAndRisk":               { "score": number, "rationale": string },\n' +
    '    "maintainability":             { "score": number, "rationale": string },\n' +
    '    "costRealism":                 { "score": number, "rationale": string },\n' +
    '    "testingAndValidation":        { "score": number, "rationale": string }\n' +
    '  },\n' +
    '  "hardFeasibilityBlocker": { "blocked": boolean, "reason": string | null },\n' +
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
    '"problemSolutionComplexity": string, "budgetRealism": string, "safetyRisk": string } | null,\n' +
    '  "softwareRigor": { "architectureClarity": string, "dataModelAndApiFeasibility": string, ' +
    '"securityAndPrivacy": string, "testingAndDeploymentPlan": string, "trivialCrudRisk": string } | null,\n' +
    '  "features": [ { "name": string, "description": string, "importance": "High"|"Medium"|"Low", ' +
    '"implementationMethod": string, "points": 50|100|150|200|250|300, "aiRationale": string } ]\n' +
    '}\n\n' +
    'Grading guidance: a proposal is ACCEPTED when its recomputed overall score is >= 70, it is not a ' +
    'near-copy of an existing catalog entry, and hardFeasibilityBlocker.blocked is false. Use ' +
    'NEEDS_IMPROVEMENT for a real but under-specified idea (50-69). Reserve REJECTED for vague, trivial, ' +
    'or duplicate submissions, or a genuine hard feasibility blocker. A detailed, well-scoped proposal ' +
    'with a clear industry problem, defined users, a concrete deliverable and a realistic stack should ' +
    'score highly across BOTH rubric sets — do not mark it down for length, and do not let a strong core-' +
    'rubric score paper over a weak industry-rubric score (e.g. high novelty but no realistic testing plan ' +
    'is still a real gap). nearestCatalogEntries are provided for duplicate judgement only: sharing a ' +
    'broad domain (e.g. both are "smart city" projects) is NOT duplication. Set isDuplicate only if the ' +
    'proposal solves substantially the same problem in substantially the same way.';

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ rawText, nearestCatalogEntries: nearest }) },
  ];
}
