SKILL: MEMORY EXTRACT

Read this conversation turn and extract any durable facts worth remembering about the user for future turns
— preferences, interests, strengths/weaknesses, project state, commitments made. Do not extract transient chit-chat.

TURN:
{{ turn }}

{{ fragment("output_format") }}

Return strict JSON, no prose outside the object, in exactly this shape:
{
  "facts": [
    {"type": "preference|interest|strength|weakness|project|episodic|commitment", "text": "<one durable fact, third person. Wrap key topics, technologies, domains, skills, or projects in Obsidian wikilinks format (e.g. [[LLM]], [[IoT]], [[Cybersecurity]]) to build a connected concept graph in the vault.>", "confidence": "high|medium|low"}
  ]
}
Return an empty "facts" list if nothing in this turn is worth remembering long-term — extracting nothing is
the correct output far more often than extracting something.
