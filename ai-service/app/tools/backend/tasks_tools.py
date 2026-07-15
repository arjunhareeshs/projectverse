from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool
from app.integrations.events import emit_ui_event


@audited_tool
async def create_task(
    project_id: str,
    title: str,
    description: str = '',
    assignee_id: str = '',
    priority: str = 'medium',
    due_date: str = '',
) -> dict:
    """Create a new task on a project's kanban board. Leave assignee_id/due_date empty if unset."""
    res = await get_node_client().post(
        '/tasks',
        {
            'projectId': project_id,
            'title': title,
            'description': description,
            'assigneeId': assignee_id or None,
            'priority': priority,
            'dueDate': due_date or None,
        },
    )
    emit_ui_event('state.refresh', {'type': 'task'})
    return res


@audited_tool
async def update_task(
    task_id: str,
    title: str = '',
    description: str = '',
    priority: str = '',
    due_date: str = '',
    status: str = '',
) -> dict:
    """Update fields on an existing task. Only fields you pass a non-empty value for are changed."""
    payload = {
        k: v
        for k, v in {
            'title': title, 'description': description, 'priority': priority,
            'dueDate': due_date, 'status': status,
        }.items()
        if v
    }
    res = await get_node_client().patch(f'/tasks/{task_id}', payload)
    emit_ui_event('state.refresh', {'type': 'task'})
    return res


@audited_tool
async def assign_task(task_id: str, assignee_id: str) -> dict:
    """Assign a task to a team member."""
    res = await get_node_client().patch(f'/tasks/{task_id}/assign', {'assigneeId': assignee_id})
    emit_ui_event('state.refresh', {'type': 'task'})
    return res


@audited_tool
async def move_kanban_card(task_id: str, column: str) -> dict:
    """Move a task to a different kanban column, e.g. 'todo', 'in_progress', 'done'."""
    res = await get_node_client().patch(f'/tasks/{task_id}', {'status': column})
    emit_ui_event('state.refresh', {'type': 'task'})
    return res


@audited_tool
async def list_tasks(project_id: str = '', assignee_id: str = '', status: str = '') -> dict:
    """List tasks, optionally filtered by project, assignee, or status (leave empty to not filter)."""
    params = {
        k: v for k, v in {'projectId': project_id, 'assigneeId': assignee_id, 'status': status}.items() if v
    }
    return await get_node_client().get('/tasks', params)

