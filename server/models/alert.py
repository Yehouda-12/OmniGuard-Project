from pydantic import BaseModel

class Alert(BaseModel):
    userId: str
    cameraName: str
    image: str  # base64
    timestamp: str
    type: str  # unknownFace / motion / multiplePeople