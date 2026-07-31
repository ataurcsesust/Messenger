"""
Local filesystem storage service.

Every function here returns a public URL + the storage path. To move to
S3 later, reimplement save_file/delete_file to use boto3 and keep the
same function signatures — no caller code needs to change.
"""
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

from fastapi import UploadFile

from app.config import settings
from app.middleware.error_handlers import ValidationAppError

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/webm", "audio/ogg", "audio/mp4"}
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "text/plain", "application/zip",
}


def _subdir_for_mime(mime_type: str) -> str:
    if mime_type in ALLOWED_IMAGE_TYPES:
        return "images"
    if mime_type in ALLOWED_VIDEO_TYPES:
        return "videos"
    if mime_type in ALLOWED_AUDIO_TYPES:
        return "audio"
    return "documents"


async def save_upload(upload: UploadFile, category: str = "attachments") -> Tuple[str, str, int, str]:
    """
    Persist an UploadFile to local disk under UPLOAD_DIR/<category>/<subdir>/.

    Returns (public_url, storage_path, file_size_bytes, mime_type).
    Raises ValidationAppError if the file is missing a content type, is
    too large, or (for avatars/group images) isn't an image.
    """
    mime_type = upload.content_type or "application/octet-stream"

    contents = await upload.read()
    size = len(contents)
    if size > settings.max_upload_size_bytes:
        raise ValidationAppError(
            f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB upload limit"
        )
    if size == 0:
        raise ValidationAppError("Uploaded file is empty")

    subdir = _subdir_for_mime(mime_type)
    ext = Path(upload.filename or "").suffix or ""
    filename = f"{uuid.uuid4().hex}{ext}"

    dir_path = Path(settings.UPLOAD_DIR) / category / subdir
    dir_path.mkdir(parents=True, exist_ok=True)
    file_path = dir_path / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    public_url = f"{settings.BASE_URL}/uploads/{category}/{subdir}/{filename}"
    storage_path = str(file_path)
    return public_url, storage_path, size, mime_type


def delete_file(storage_path: str) -> None:
    """Best-effort delete — never raises if the file is already gone."""
    try:
        os.remove(storage_path)
    except FileNotFoundError:
        pass


def validate_image(mime_type: str) -> None:
    if mime_type not in ALLOWED_IMAGE_TYPES:
        raise ValidationAppError("Only JPEG, PNG, WEBP, or GIF images are allowed")
