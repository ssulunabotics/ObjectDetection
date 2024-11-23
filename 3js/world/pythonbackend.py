from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
from PIL import Image
from ultralytics import YOLO
import traceback

app = FastAPI()

# Load YOLOv8 model
try:
    model = YOLO('yolov8n.pt')  # Adjust to 'yolov11n.pt' when released
except Exception as e:
    print("Error loading YOLO model:", str(e))
    traceback.print_exc()

# Mount the "world" directory to serve static files (HTML, JS, CSS)
app.mount("/static", StaticFiles(directory="."), name="static")


@app.get("/")
async def serve_index():
    # Serve the main HTML file
    return FileResponse("world.html")


@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive JSON data from WebSocket
            data = await websocket.receive_json()
            width = data['width']
            height = data['height']
            pixel_data = np.array(data['pixels'], dtype=np.uint8).reshape((height, width, 4))  # RGBA format

            # Convert raw pixels to PIL Image (drop alpha channel)
            image = Image.fromarray(pixel_data[:, :, :3])  # Use only RGB channels

            # Run YOLO inference
            results = model(image)

            # Process YOLO predictions
            predictions = results[0].boxes  # Access the boxes attribute
            processed = [
                {
                    "box": [float(x1), float(y1), float(x2), float(y2)],
                    "score": float(conf),
                    "class": int(cls),
                }
                for x1, y1, x2, y2, conf, cls in zip(
                    predictions.xyxy[:, 0],  # x1
                    predictions.xyxy[:, 1],  # y1
                    predictions.xyxy[:, 2],  # x2
                    predictions.xyxy[:, 3],  # y2
                    predictions.conf,       # confidence
                    predictions.cls          # class
                )
            ]

            # Send processed predictions back to the client
            await websocket.send_json({"predictions": processed})
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print("Error Traceback:", traceback.format_exc())
        await websocket.send_json({"error": str(e)})