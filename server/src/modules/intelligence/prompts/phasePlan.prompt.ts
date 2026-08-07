import { ChatMessage } from '../../ai/llm.service';

export function buildPhasePlanPrompt(
  problemStatement: string,
  projectType: string | null,
  featureTotal: number,
  weeks: number,
): ChatMessage[] {
  const system =
    'Generate the 4 mandatory execution-review phases for this student project. Every project — ' +
    'software or hardware — goes through exactly these 4 checkpoints, but WHAT counts as the ' +
    'deliverable at each checkpoint depends on project type:\n\n' +
    'Phase 1 — Planning & Architecture: a complete implementation plan (system architecture, chosen ' +
    'stack, data/API/circuit design) plus a first slice of working code for at least one low-risk ' +
    'feature. For Hardware/IoT projects, substitute "working code" with a concrete component/BOM ' +
    'selection and circuit schematic, or an early breadboard-level improvement over the baseline design.\n' +
    'Phase 2 — Initial Implementation: visible, running progress on the highest-priority features — ' +
    'partial but real functionality, not just planning artifacts. For hardware, this is ' +
    'firmware/sensor-loop progress on the breadboard build.\n' +
    'Phase 3 — Base Prototype: a working end-to-end prototype covering the core feature set, even if ' +
    'rough at the edges. For hardware, this is the assembled physical prototype with its main ' +
    'sensing/actuation loop functioning.\n' +
    'Phase 4 — Full-Grade System: the complete, polished, demo-ready system — all committed features ' +
    'present, tested, and (for hardware) in a finished enclosure/field-ready state.\n\n' +
    `Distribute "points" across the 4 phases proportional to how much of the total feature-potential ` +
    `(sum of feature points = ${featureTotal}) each phase is expected to deliver. Typical shape: ` +
    'Phase 1 ~15%, Phase 2 ~30-35%, Phase 3 ~30-35%, Phase 4 ~15-20% of a total phase-reward pool ' +
    `roughly double the feature total (so a ${featureTotal}-point feature plan yields a phase pool ` +
    `around ${featureTotal * 2}). Space weekTarget values sensibly across the project's duration ` +
    `(${weeks} weeks total).\n\n` +
    'Respond with ONLY a JSON object in EXACTLY this shape:\n' +
    '{ "phases": [ { "phaseNumber": 1|2|3|4, "title": string, "weekTarget": number, ' +
    '"expectedDeliverables": string, "points": number, "hardwareNote": string | null } ] } ' +
    '(exactly 4 entries, phaseNumber 1 through 4 in order).';

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ problemStatement, projectType, featureTotal, weeks }) },
  ];
}
