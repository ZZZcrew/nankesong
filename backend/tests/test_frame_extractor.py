from pathlib import Path
import numpy as np
import cv2
import pytest

from app.services.frame_extractor import extract_keyframes


def _make_sample_video(path: Path, seconds: int = 3, fps: int = 10, size=(320, 240)):
    """用 cv2 写一段纯色视频作为测试 fixture。"""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    w, h = size
    writer = cv2.VideoWriter(str(path), fourcc, fps, (w, h))
    for i in range(seconds * fps):
        # 每秒颜色渐变
        color = (i * 5 % 255, 100, 200)
        frame = np.full((h, w, 3), color, dtype=np.uint8)
        writer.write(frame)
    writer.release()


@pytest.fixture
def sample_video(tmp_path):
    video = tmp_path / "sample.mp4"
    _make_sample_video(video, seconds=3)
    return str(video)


def test_extract_keyframes_returns_image_paths(sample_video, tmp_path):
    out = tmp_path / "frames"
    frames = extract_keyframes(
        video_path=sample_video,
        output_dir=str(out),
        every_n_seconds=1,
    )
    assert len(frames) >= 1
    for f in frames:
        assert Path(f).exists()
        assert f.endswith(".jpg")


def test_extract_keyframes_samples_at_interval(sample_video, tmp_path):
    """3 秒视频，每 1 秒抽一帧 → 期望 2-4 帧（边界根据 fps 可能波动）"""
    out = tmp_path / "frames"
    frames = extract_keyframes(
        video_path=sample_video,
        output_dir=str(out),
        every_n_seconds=1,
    )
    assert 2 <= len(frames) <= 4


def test_extract_keyframes_missing_video_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        extract_keyframes(
            video_path="/does/not/exist.mp4",
            output_dir=str(tmp_path),
            every_n_seconds=1,
        )


def test_extract_keyframes_unreadable_video_raises(tmp_path):
    bad = tmp_path / "bad.mp4"
    bad.write_bytes(b"not a real video")
    with pytest.raises(RuntimeError, match="cannot open"):
        extract_keyframes(
            video_path=str(bad),
            output_dir=str(tmp_path / "frames"),
            every_n_seconds=1,
        )
