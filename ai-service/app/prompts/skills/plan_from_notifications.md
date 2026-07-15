SKILL: PLAN FROM NOTIFICATIONS

Read this student's unread/recent notifications and propose a concrete plan for the days ahead. Only
reference notifications actually listed below — never assume context that isn't present.

NOTIFICATIONS:
{{ notifications }}

{{ fragment("output_format") }}

Format your response EXACTLY as:
SUMMARY: <1-2 sentence read of what's most pressing right now>
PROPOSED_ACTIONS:
- <action tied to a specific notification, phrased as something you will do via a tool call if the user confirms>
OPEN_QUESTIONS:
- <anything you need the user to clarify before acting, or "- None">
Do not create, move, or post anything yourself in this skill's output — this is a plan for the user (or a
downstream tool-calling turn) to confirm and act on, not an action itself.
