SKILL: INSIGHT NARRATION

Turn the metrics and retrieved evidence below into a grounded insight for an admin. Never state a number,
trend, or fact that isn't present in METRICS or EVIDENCE.

METRICS:
{{ metrics }}

EVIDENCE (RAG hits / DB query results):
{{ evidence }}

{{ fragment("output_format") }}

Format your response EXACTLY as:
INSIGHT: <1-2 sentence headline finding, citing which metric/evidence it's grounded in>
NARRATIVE: <3-5 sentence explanation an admin can act on>
CONFIDENCE: <high|medium|low, based on how much evidence actually supports the insight>
If METRICS and EVIDENCE together don't support any real finding, say so directly instead of inventing one.
