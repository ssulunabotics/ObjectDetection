# Python Backend
# Server for running YOLO model and sending predictions back over WebSocket
# IN: Binary pixel data
# OUT: json predictions object

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import numpy as np
from PIL import Image
from ultralytics import YOLO
import traceback
import numpy as np
import struct
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)


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

# Filter out very large boxes
def filter_large_boxes(predictions, max_area_threshold=0.3):
    filtered_boxes = []
    for pred in predictions:
        x1, y1, x2, y2 = pred['box']
        width = x2 - x1
        height = y2 - y1
        area = width * height
        if area < max_area_threshold:  # Adjust the threshold as needed
            filtered_boxes.append(pred)
    return filtered_boxes

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
            # Receive binary data from WebSocket
            data = await websocket.receive_bytes()
            width = int.from_bytes(data[:4], "big")  # First 4 bytes: width
            height = int.from_bytes(data[4:8], "big")  # Next 4 bytes: height

            # Grayscale pixels are a single-channel array
            pixel_data = np.frombuffer(data[8:], dtype=np.uint8).reshape((height, width))

            # Convert the grayscale image to RGB
            grayscale_image = Image.fromarray(pixel_data, mode='L')  # Create grayscale image
            rgb_image = grayscale_image.convert("RGB")  # Convert to RGB for YOLO model

            # Run YOLO inference
            results = model(source=np.array(rgb_image), task='predict', device='cpu')

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

            # Filter out very large boxes
            max_area_threshold = width * height * 0.05  # 5% of the image area
            filtered_large_boxes = filter_large_boxes(processed, max_area_threshold)

            # Apply Non-Maximum Suppression
            filtered_predictions = non_maximum_suppression(filtered_large_boxes, iou_threshold=0.5)


            # Send filtered predictions back to the client
            await websocket.send_json({"predictions": filtered_predictions})
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print("Error Traceback:", traceback.format_exc())
        await websocket.send_json({"error": str(e)})