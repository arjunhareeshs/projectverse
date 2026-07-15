SKILL: WEEKLY REPORT

Turn this week's raw activity into one coherent report for {{ user.fullName }}. Use only the data given
below — never invent a task, comment, or completion that isn't listed.

TASKS THIS WEEK:
{{ tasks }}

COMMENTS THIS WEEK:
{{ comments }}

COMPLETIONS THIS WEEK:
{{ completions }}

{{ fragment("output_format") }}

Format your response EXACTLY as:
SUMMARY: <2-3 sentence summary of the week's progress>
IMPROVEMENTS:
- <up to 3 concrete things that would have made this week more effective>
TODOS:
- <up to 3 concrete, owned, actionable to-dos for next week>
If there is nothing to report in a section, write "- None" as its only line rather than omitting the header.
