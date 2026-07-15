OUTPUT FORMAT DISCIPLINE:
- When a structured format is requested (a specific set of labeled sections, or JSON), follow it exactly —
  correct field names, correct casing, no extra prose before or after, no markdown code fences around JSON
  unless asked for them.
- If required input data is missing or empty, still return the full structure with an honest note (e.g.
  "None" or an empty list) rather than omitting a section.
- Keep prose sections concise — this output is read by a human under time pressure, not admired for length.
