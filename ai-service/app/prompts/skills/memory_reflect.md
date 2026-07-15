SKILL: MEMORY REFLECT

Consolidate these episodic memory entries into durable semantic facts, and flag which existing facts below
look stale and should decay. Only work from what's given — never invent an episode.

EPISODES SINCE LAST REFLECTION:
{{ episodes }}

EXISTING SEMANTIC FACTS (candidates for reinforcement or decay):
{{ existing_facts }}

{{ fragment("output_format") }}

Return strict JSON, no prose outside the object, in exactly this shape:
{
  "new_facts": [{"text": "<consolidated fact>", "source_episodes": ["<episode id>", "..."], "confidence": "high|medium|low"}],
  "reinforced_fact_ids": ["<id>", "..."],
  "decayed_fact_ids": ["<id>", "..."],
  "decay_reasoning": {"<id>": "<why this fact looks stale now>"}
}
A fact decays only when the episodes actively contradict it or enough time/inactivity makes it unreliable —
never decay a fact just because this batch of episodes didn't happen to reference it.
