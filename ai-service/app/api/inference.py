from fastapi import APIRouter
from app.schemas.inference import (
    InferenceResponse, TaskRequest,
    TeamCoordinationRequest, TeamCoordinationInsightsResponse,
)
from app.services.llm_provider import llm_provider_service

router = APIRouter(tags=['inference'])

# NOTE: the old unauthenticated `POST /chat` (placeholder JSON response) used to live here.
# It has been superseded by the authenticated, streaming `POST /chat` in app/api/chat.py
# (Stage 1 of ai-service/plan/). Node's admin.controller.ts `generateChat` still calls the
# old unsigned contract and now gets a 401 + SSE body instead of `{output, provider}` JSON —
# see the Stage 1 completion note for the Node-side fix required.


@router.post('/project-plan', response_model=InferenceResponse)
def project_plan(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/meeting-summary', response_model=InferenceResponse)
def meeting_summary(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/risk-analysis', response_model=InferenceResponse)
def risk_analysis(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/weekly-report', response_model=InferenceResponse)
def weekly_report(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/summarize', response_model=InferenceResponse)
def summarize(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/user-story', response_model=InferenceResponse)
def user_story(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/requirements', response_model=InferenceResponse)
def requirements(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/release-notes', response_model=InferenceResponse)
def release_notes(payload: TaskRequest) -> InferenceResponse:
    output, provider = llm_provider_service.generate(payload.content)
    return InferenceResponse(output=output, provider=provider)


@router.post('/team-coordination-insights', response_model=TeamCoordinationInsightsResponse)
def team_coordination_insights(payload: TeamCoordinationRequest) -> TeamCoordinationInsightsResponse:
    """
    Accepts structured team metrics, builds a leadership-focused prompt,
    and returns an AI-generated narrative with key issues and recommendations.
    """
    workload_lines = '\n'.join(
        f"  - {w.memberName}: {w.taskCount} tasks ({w.completedCount} done, {w.overdueCount} overdue)"
        for w in payload.workloadPerMember
    )
    overdue_lines = '\n'.join(
        f"  - \"{t.title}\" (assigned to {t.assignee}, {t.daysOverdue} days overdue, priority: {t.priority})"
        for t in payload.overdueTaskList[:5]  # cap at 5 for prompt size
    )
    inactive_str = ', '.join(payload.inactiveMembers) if payload.inactiveMembers else 'None'
    turnaround_str = (
        f"{payload.avgTurnaroundDays:.1f} days" if payload.avgTurnaroundDays else 'N/A (no completed tasks yet)'
    )
    milestone_str = (
        f"{payload.milestoneHitRate:.1f}%" if payload.milestoneHitRate is not None else 'N/A'
    )

    prompt = f"""You are a leadership and team coordination advisor. Analyze the following real-time metrics for team "{payload.teamName}" led by captain {payload.captainName} and provide a concise, actionable assessment.

=== TEAM SNAPSHOT ===
Members: {payload.totalMembers}
Active Projects: {payload.activeProjects}
Meetings in last 14 days: {payload.meetingsLast14Days}
Average task turnaround: {turnaround_str}
Milestone hit rate: {milestone_str}

=== WORKLOAD DISTRIBUTION ===
Team average: {payload.teamAverageTaskLoad:.1f} tasks/member
Captain's share: {payload.captainTaskShare:.1f}% of all tasks
{workload_lines}

=== OVERDUE TASKS ({payload.overdueTaskCount} total) ===
{overdue_lines or '  None — great!'}

=== COMMUNICATION ===
Silent tasks (open, 0 comments): {payload.silentTaskCount}

=== ENGAGEMENT ===
Inactive members (no activity in 7 days): {inactive_str}

Based on these metrics, provide:
1. A 2-3 sentence summary of the team's current coordination health.
2. Up to 3 KEY ISSUES (the most critical things hurting coordination right now).
3. Up to 3 CONCRETE RECOMMENDATIONS (specific, actionable steps the captain should take this week).

Format your response EXACTLY as:
SUMMARY: <your 2-3 sentence summary>
KEY_ISSUES:
- <issue 1>
- <issue 2>
- <issue 3>
RECOMMENDATIONS:
- <recommendation 1>
- <recommendation 2>
- <recommendation 3>"""

    output, provider = llm_provider_service.generate(prompt)

    # Parse structured output
    summary = ''
    key_issues: list[str] = []
    recommendations: list[str] = []
    section = None

    for line in output.splitlines():
        line = line.strip()
        if line.startswith('SUMMARY:'):
            summary = line[len('SUMMARY:'):].strip()
        elif line == 'KEY_ISSUES:':
            section = 'issues'
        elif line == 'RECOMMENDATIONS:':
            section = 'recs'
        elif line.startswith('- ') and section == 'issues':
            key_issues.append(line[2:].strip())
        elif line.startswith('- ') and section == 'recs':
            recommendations.append(line[2:].strip())

    # Fallback if LLM didn't follow format exactly
    if not summary:
        summary = output[:300]
    if not key_issues:
        key_issues = ['See full analysis above']
    if not recommendations:
        recommendations = ['Review the AI analysis and identify action items']

    return TeamCoordinationInsightsResponse(
        summary=summary,
        provider=provider,
        keyIssues=key_issues,
        recommendations=recommendations,
    )


@router.post('/api/v1/inference')
def general_inference(payload: dict) -> dict:
    prompt = payload.get('prompt', '') or payload.get('content', '')
    output, provider = llm_provider_service.generate(prompt)
    return {
        "output": output,
        "response": output,
        "content": output,
        "provider": provider
    }


