import { ChatMessage } from '../../ai/llm.service';

export interface ExistingFeatureContext {
  id: string;
  name: string;
  description: string;
  points: number;
}

export interface ProposedFeatureInput {
  name: string;
  description: string;
  implementationMethod: string;
}

export function buildFeatureChangePrompt(
  problemStatement: string,
  projectType: string | null,
  existingFeatures: ExistingFeatureContext[],
  proposed: ProposedFeatureInput,
): ChatMessage[] {
  const system =
    'You are scoring ONE feature being added to an already-accepted student project. You are given ' +
    'the project\'s original problem statement, its current feature list with their existing point ' +
    'values, and the new/edited feature the student is proposing.\n\n' +
    'Score it using the same rules as initial feature extraction: points from ' +
    '{50,100,150,200,250,300} based on technical depth AND the described implementation method ' +
    '(trained/custom-built > tuned-existing > direct-API/library-default). If this feature ' +
    'substantially duplicates an existing one in the list, set duplicateOfFeatureId to that ' +
    'feature\'s id and score it low (50) — do not let two features double-count the same capability.\n\n' +
    'Respond with ONLY a JSON object in EXACTLY this shape:\n' +
    '{ "points": 50|100|150|200|250|300, "importance": "High"|"Medium"|"Low", "aiRationale": string, ' +
    '"duplicateOfFeatureId": string | null }';

  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: JSON.stringify({
        problemStatement,
        projectType,
        existingFeatures,
        proposedFeature: proposed,
      }),
    },
  ];
}
