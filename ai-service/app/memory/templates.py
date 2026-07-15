FACTS_HEADING = '## Facts'
EVENTS_HEADING = '## Events'
PLACEHOLDER = '_No data yet._'

# Every canonical top-level vault file — all "semantic" type per the Stage 5 mapping (episodic
# and procedural memory live in the episodes/ and procedures/ subdirectories instead).
CANONICAL_FILES: dict[str, dict] = {
    'profile.md': {'title': 'Profile', 'type': 'semantic', 'tags': ['profile']},
    'preferences.md': {'title': 'Preferences', 'type': 'semantic', 'tags': ['preferences']},
    'interests.md': {'title': 'Interests', 'type': 'semantic', 'tags': ['interests']},
    'project.md': {'title': 'Project', 'type': 'semantic', 'tags': ['project']},
    'team.md': {'title': 'Team', 'type': 'semantic', 'tags': ['team']},
    'strengths.md': {'title': 'Strengths', 'type': 'semantic', 'tags': ['strengths']},
    'weaknesses.md': {'title': 'Weaknesses', 'type': 'semantic', 'tags': ['weaknesses']},
    'improvements.md': {'title': 'Improvements', 'type': 'semantic', 'tags': ['improvements']},
    'plans.md': {'title': 'Plans', 'type': 'semantic', 'tags': ['plans']},
    'backlogs.md': {'title': 'Backlogs', 'type': 'semantic', 'tags': ['backlogs']},
    'schedule.md': {'title': 'Schedule', 'type': 'semantic', 'tags': ['schedule']},
    'db_snapshot.md': {'title': 'DB Snapshot', 'type': 'semantic', 'tags': ['db_snapshot']},
}


def scaffold_body(filename: str) -> str:
    title = CANONICAL_FILES[filename]['title']
    return f'# {title}\n\n{FACTS_HEADING}\n{PLACEHOLDER}\n'
