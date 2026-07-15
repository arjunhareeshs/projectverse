from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, pass_context

PROMPTS_ROOT = Path(__file__).resolve().parent


class PromptLibrary:
    """Loads system prompts + skills as Jinja2 templates, cached by name.

    A prompt is referenced by its path relative to app/prompts/, without the .md extension
    (e.g. "system/core_system", "system/core_system@v2", "skills/weekly_report"). Callers pin
    an explicit version (the "@vN" suffix) so a later prompt edit never silently changes
    behavior for a session that requested an earlier version — the un-suffixed name is always
    the current default.

    Templates compose via two Jinja globals, both given the calling template's full context:
    - `{{ include("system/core_system") }}` — pulls in another prompt by its full path.
    - `{{ fragment("safety") }}` — shorthand for `include("fragments/<name>")`.
    """

    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(PROMPTS_ROOT)),
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self._env.globals['include'] = self._partial_renderer(PROMPTS_ROOT)
        self._env.globals['fragment'] = self._partial_renderer(PROMPTS_ROOT / 'fragments')

    def _partial_renderer(self, base_dir: Path):
        @pass_context
        def _render(ctx, name: str, **override_ctx) -> str:
            rel_path = Path(name).with_suffix('.md')
            template_name = (base_dir / rel_path).relative_to(PROMPTS_ROOT).as_posix()
            template = self._env.get_template(template_name)
            merged = {**ctx.get_all(), **override_ctx}
            return template.render(**merged)

        return _render

    def render(self, name: str, **ctx) -> str:
        template = self._env.get_template(f'{name}.md')
        return template.render(**ctx)


@lru_cache
def get_prompt_library() -> PromptLibrary:
    return PromptLibrary()
