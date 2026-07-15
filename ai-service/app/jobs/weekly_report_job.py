import logging
from datetime import datetime

from langchain_core.messages import SystemMessage

from app.core.config import get_settings
from app.llm.provider import LLMProvider
from app.prompts import get_prompt_library
from app.tools.backend.node_client import get_node_client
from app.tools.backend.tasks_tools import list_tasks
from app.tools.backend.documents_tools import create_document
from app.jobs.runner import register_job_handler

logger = logging.getLogger(__name__)


async def run_weekly_report_job(payload: dict) -> dict:
    user_id = payload.get('user_id')
    project_id = payload.get('project_id', '')
    team_id = payload.get('team_id', '')
    
    if not user_id:
        raise ValueError("user_id is required for weekly_report_job")
        
    client = get_node_client()
    
    full_name = user_id
    try:
        if team_id:
            res = await client.get(f"/teams/{team_id}/members")
            for member in res.get('members', []):
                if member.get('id') == user_id:
                    full_name = member.get('fullName', user_id)
                    break
    except Exception as e:
        logger.warning(f"Could not fetch user profile for weekly report: {e}")
        
    try:
        tasks_res = await list_tasks(project_id=project_id, assignee_id=user_id)
        tasks_list = tasks_res.get('tasks', []) if isinstance(tasks_res, dict) else tasks_res
        if not isinstance(tasks_list, list):
            tasks_list = []
    except Exception as e:
        logger.error(f"Failed to fetch tasks for user {user_id}: {e}")
        tasks_list = []
        
    active_tasks = []
    completed_tasks = []
    comments_list = []
    
    for task in tasks_list:
        title = task.get('title', 'Untitled')
        desc = task.get('description', '')
        status = task.get('status', '').lower()
        priority = task.get('priority', 'medium')
        due = task.get('dueDate', 'N/A')
        
        is_overdue = False
        if due and due != 'N/A':
            try:
                # Handle ISO format parsing
                cleaned_due = due.replace('Z', '+00:00')
                due_date = datetime.fromisoformat(cleaned_due).date()
                if due_date < datetime.now().date() and status != 'done':
                    is_overdue = True
            except Exception:
                pass
                
        overdue_flag = " [OVERDUE]" if is_overdue else ""
        task_str = f"- \"{title}\"{overdue_flag} (Priority: {priority}, Due: {due})"
        if desc:
            task_str += f" - Description: {desc}"
            
        if status == 'done':
            completed_tasks.append(task_str)
        else:
            active_tasks.append(task_str)
            
        for comment in task.get('comments', []):
            author = comment.get('user', {}).get('fullName', 'Unknown')
            body = comment.get('body', '')
            if body:
                comments_list.append(f"- \"{body}\" (on task \"{title}\" by {author})")
                
    llm = LLMProvider(get_settings())
    prompt = get_prompt_library().render(
        "skills/weekly_report",
        user={"fullName": full_name},
        tasks="\n".join(active_tasks) if active_tasks else "- None",
        comments="\n".join(comments_list) if comments_list else "- None",
        completions="\n".join(completed_tasks) if completed_tasks else "- None"
    )
    
    response = await llm.chat([SystemMessage(content=prompt)])
    report_text = response.content.strip()
    
    title = f"Weekly Performance Report: {full_name} ({datetime.now().date().isoformat()})"
    doc_res = await create_document(title=title, content=report_text, project_id=project_id)
    
    return {
        'status': 'success',
        'document': doc_res,
        'report_content': report_text
    }


# Register the handler
register_job_handler('weekly_report', run_weekly_report_job)
