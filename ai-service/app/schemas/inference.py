from pydantic import BaseModel, Field
from typing import List, Optional


class TaskRequest(BaseModel):
    content: str = Field(min_length=1)


class InferenceResponse(BaseModel):
    output: str
    provider: str


class WorkloadEntry(BaseModel):
    memberId: str
    memberName: str
    taskCount: int
    completedCount: int
    overdueCount: int


class OverdueTask(BaseModel):
    taskId: str
    title: str
    assignee: str
    daysOverdue: int
    priority: str


class CommentsPerDay(BaseModel):
    date: str
    count: int


class TurnaroundTrendEntry(BaseModel):
    week: str
    avgDays: float


class MeetingCadenceEntry(BaseModel):
    week: str
    meetings: int
    projects: int


class MilestoneTrendEntry(BaseModel):
    month: str
    hitRate: float


class DelegationSegment(BaseModel):
    name: str
    value: float


class MemberEngagementActivity(BaseModel):
    week: str
    count: int


class MemberEngagementEntry(BaseModel):
    memberName: str
    weeklyActivity: List[MemberEngagementActivity]


class TeamHealthRadarEntry(BaseModel):
    subject: str
    A: float
    fullMark: int


class TeamCoordinationRequest(BaseModel):
    teamName: str
    captainName: str
    totalMembers: int
    activeProjects: int
    # Workload balance
    workloadPerMember: List[WorkloadEntry]
    teamAverageTaskLoad: float
    captainTaskShare: float  # percentage 0-100
    # Overdue / aging
    overdueTaskCount: int
    overdueTaskList: List[OverdueTask]
    # Turnaround
    avgTurnaroundDays: Optional[float]
    # Communication
    silentTaskCount: int  # open tasks with 0 comments
    commentsLast30Days: List[CommentsPerDay]
    # Meeting cadence
    meetingsLast14Days: int
    # Sprint / milestone
    milestoneHitRate: Optional[float]  # percentage 0-100
    # Engagement
    inactiveMembers: List[str]  # names of members with 0 activity in 7 days
    # Trends and Advanced metrics
    turnaroundTrend: Optional[List[TurnaroundTrendEntry]] = None
    meetingCadence: Optional[List[MeetingCadenceEntry]] = None
    milestoneTrend: Optional[List[MilestoneTrendEntry]] = None
    delegationRatio: Optional[List[DelegationSegment]] = None
    memberEngagement: Optional[List[MemberEngagementEntry]] = None
    radarScore: Optional[List[TeamHealthRadarEntry]] = None


class TeamCoordinationInsightsResponse(BaseModel):
    summary: str
    provider: str
    keyIssues: List[str]
    recommendations: List[str]
