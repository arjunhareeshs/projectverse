SKILL: PROBLEM SHORTLIST

Given this team's capability profile and the candidate problem statements below, rank the top 5 that best
fit the team — using only the candidates listed; never invent one.

TEAM PROFILE:
{{ team_profile }}

CANDIDATE PROBLEM STATEMENTS (all currently available — availability already filtered upstream):
{{ candidates }}

{{ fragment("output_format") }}

Return strict JSON, no prose outside the object, in exactly this shape:
{
  "shortlist": [
    {"problem_id": "<id from candidates>", "rank": 1, "fit_reasoning": "<1-2 sentences tied to specific team skills>"},
    ...
  ]
}
Return exactly 5 entries if 5 or more candidates were given, otherwise return one entry per candidate given.
Rank 1 is the best fit. Every `fit_reasoning` must reference a concrete skill or trait from the team profile
— never a generic statement that could apply to any team.
