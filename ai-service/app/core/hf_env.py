import os


def disable_hf_symlinks() -> None:
    """Works around a Windows-specific `huggingface_hub` bug: its own symlink self-test can
    report support as available while the real download-time `os.symlink()` call still raises
    `OSError: [WinError 1314] A required privilege is not held by the client` (Developer Mode /
    admin privilege not held, or granted inconsistently across threads). Forcing the check to
    report unsupported makes `huggingface_hub` use its documented safe fallback — duplicating
    the file instead of symlinking it — at the cost of extra disk space, not correctness.

    Must run before any module (docling, sentence-transformers, llama-index embeddings, etc.)
    triggers its first Hugging Face Hub download.
    """
    os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')
    if os.name != 'nt':
        return
    try:
        import huggingface_hub.file_download as hf_file_download

        hf_file_download.are_symlinks_supported = lambda *_args, **_kwargs: False
    except ImportError:
        pass
