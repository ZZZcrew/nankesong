from pathlib import Path
from uuid import uuid4

import cv2


def extract_keyframes(
    video_path: str,
    output_dir: str,
    every_n_seconds: int = 2,
) -> list[str]:
    """Sample one frame every N seconds from a video; write as JPG.

    Returns list of absolute JPG paths sorted by timestamp.
    """
    video = Path(video_path)
    if not video.exists():
        raise FileNotFoundError(f"video not found: {video_path}")

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    prefix = uuid4().hex[:8]

    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = max(1, int(round(fps * every_n_seconds)))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    saved: list[str] = []
    try:
        idx = 0
        sample_idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % frame_interval == 0:
                path = out / f"{prefix}_{sample_idx:03d}.jpg"
                cv2.imwrite(str(path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                saved.append(str(path))
                sample_idx += 1
            idx += 1
            if total and idx >= total:
                break
    finally:
        cap.release()

    return saved
