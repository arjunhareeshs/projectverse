from fastapi import APIRouter, Request

router = APIRouter(prefix='/health', tags=['health'])


@router.get('')
def health_check(request: Request) -> dict:
    models_warm = getattr(request.app.state, 'models_warm', {'embed': False, 'rerank': False})
    return {
        'status': 'ok',
        'service': 'projectverse-ai-service',
        'models_warm': models_warm,
    }
