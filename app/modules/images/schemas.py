from typing import Dict, List


def upload_response(message: str, saved: List[str], skipped: int) -> Dict:
    return {
        "message": message,
        "added": len(saved),
        "skipped": skipped,
        "items": saved,
    }
