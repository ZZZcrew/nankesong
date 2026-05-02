from app.services.vision import caption_image, VisionClient


class FakeVisionClient:
    def __init__(self, caption="小明在吃火锅"):
        self.caption = caption
        self.calls = []

    def describe(self, image_b64: str, prompt: str) -> str:
        self.calls.append((image_b64[:10], prompt))
        return self.caption


def test_caption_image_reads_file_and_calls_client(tmp_path):
    img = tmp_path / "fake.jpg"
    img.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 100)  # minimal jpg bytes
    fake = FakeVisionClient("一张红色的图")

    caption = caption_image(str(img), fake)

    assert caption == "一张红色的图"
    assert len(fake.calls) == 1


def test_caption_image_missing_file_raises(tmp_path):
    fake = FakeVisionClient()
    import pytest
    with pytest.raises(FileNotFoundError):
        caption_image(str(tmp_path / "nope.jpg"), fake)
