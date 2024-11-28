from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
from PIL import Image
from ultralytics import YOLO
import traceback
import numpy as np


app = FastAPI()

# Utility function to compute IoU (Intersection over Union)
def compute_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    # Compute the area of intersection
    intersection = max(0, x2 - x1) * max(0, y2 - y1)

    # Compute the area of both boxes
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])

    # Compute the union area
    union = area1 + area2 - intersection

    # Avoid division by zero
    if union == 0:
        return 0

    # Return IoU
    return intersection / union

# Non-Maximum Suppression
def non_maximum_suppression(predictions, iou_threshold=0.5):
    if len(predictions) == 0:
        return []

    # Sort predictions by confidence score in descending order
    predictions = sorted(predictions, key=lambda x: x['score'], reverse=True)

    # Perform NMS
    filtered_predictions = []
    while predictions:
        best_prediction = predictions.pop(0)
        filtered_predictions.append(best_prediction)
        predictions = [
            pred for pred in predictions
            if compute_iou(best_prediction['box'], pred['box']) < iou_threshold
        ]

    return filtered_predictions

# Load YOLOv8 model
try:
    model = YOLO('weights/best.pt')  # Adjust to 'yolov11n.pt' when released
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

            # Apply Non-Maximum Suppression
            filtered_predictions = non_maximum_suppression(processed, iou_threshold=0.5)

            # Send filtered predictions back to the client
            await websocket.send_json({"predictions": filtered_predictions})
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print("Error Traceback:", traceback.format_exc())
        await websocket.send_json({"error": str(e)})