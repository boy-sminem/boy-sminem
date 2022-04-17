import base64

from fastapi import APIRouter, WebSocket
from starlette.concurrency import run_in_threadpool

from backend.app.ml.constant import ATTRIBUTES
from backend.app.ml.inference import ModelInference

router = APIRouter()

model = ModelInference("./ml/mobilenetv2_140_best.ckpt")


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    while True:
        try:
            data = await websocket.receive_json()
            response = {"person_id": data["person_id"], "result": []}
            image = base64.decodebytes(data["img"])
            probs = await run_in_threadpool(model.image_inference, image)
            for k, v in ATTRIBUTES.items():
                response["result"].append({"attribute_name": v.lower(), "data": probs[k]})
            await websocket.send_json(response)

        except Exception as e:
            break
