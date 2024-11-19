import cv2
import numpy as np

# Define color ranges in HSV
RED_RANGE = [(165, 40, 40), (180, 255, 255)]  # Expanded range for red
GREEN_RANGE = [(35, 50, 50), (85, 255, 255)]  # Expanded range for green
BLUE_RANGE = [(110, 100, 100), (130, 255, 255)]

# Known size of blue square in real-world units (e.g., pixels for full visibility)
BLUE_SQUARE_FULL_AREA = 5000  # Example: Adjust this based on your square size

def detect_square_properties(image, color_range):
    """Detect colored squares and return their centroids and bounding box areas."""
    mask = cv2.inRange(image, np.array(color_range[0]), np.array(color_range[1]))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    properties = []
    for cnt in contours:
        M = cv2.moments(cnt)
        if M["m00"] > 0:  # Avoid division by zero
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            area = cv2.contourArea(cnt)
            properties.append({"centroid": (cx, cy), "area": area})
    return properties

def calculate_orientation_and_distance(red, green):
    """Calculate orientation and distance using the centroids of Red and Green squares."""
    if red and green:
        red_x, red_y = red
        green_x, green_y = green
        # Calculate the angle (orientation) using atan2
        dx = green_x - red_x
        dy = green_y - red_y
        angle = np.degrees(np.arctan2(dy, dx))
        # Calculate the Euclidean distance
        distance_pixels = np.sqrt(dx**2 + dy**2)
# Hardcoded conversion: 260 cm (8.53 ft) corresponds to 200 pixels
        reference_pixels = 200  # Pixels for the reference distance
        reference_distance_feet = 8.53  # Corresponding reference distance in feet

        # Use inverse proportionality
        distance_feet = (reference_pixels / distance_pixels) * reference_distance_feet

        # Round distance to 1 significant digit
        distance_feet = round(distance_feet, -int(np.floor(np.log10(abs(distance_feet)))))

        return angle, distance_feet
    return None, None

def check_blue_visibility(blue_area):
    """Check if the blue square is more than 50% visible."""
    return blue_area >= 0.5 * BLUE_SQUARE_FULL_AREA

def main():
    cap = cv2.VideoCapture(1)  # Open camera

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Convert to HSV
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # Detect centroids and areas for each color
        red_properties = detect_square_properties(hsv, RED_RANGE)
        green_properties = detect_square_properties(hsv, GREEN_RANGE)
        blue_properties = detect_square_properties(hsv, BLUE_RANGE)

        # Get the largest detected square for each color (most likely correct)
        red = max(red_properties, key=lambda x: x["area"], default=None)
        green = max(green_properties, key=lambda x: x["area"], default=None)
        blue = max(blue_properties, key=lambda x: x["area"], default=None)

        # Calculate orientation and distance
        red_centroid = red["centroid"] if red else None
        green_centroid = green["centroid"] if green else None
        orientation, distance = calculate_orientation_and_distance(red_centroid, green_centroid)

        # Check blue square visibility
        blue_visible = False
        if blue:
            blue_visible = check_blue_visibility(blue["area"])

        # Visualize results
        for prop in [red, green, blue]:
            if prop:
                cv2.circle(frame, prop["centroid"], 10, (0, 255, 255), -1)  # Mark centroids
                cv2.putText(frame, f"Area: {prop['area']:.2f}",
                            (prop["centroid"][0], prop["centroid"][1] - 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        if orientation is not None and distance is not None:
            cv2.putText(frame, f"Orientation: {orientation:.2f} degrees",
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(frame, f"Distance: {distance:.2f} ft.",
                        (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        if blue_visible:
            cv2.putText(frame, "Blue square visible: LOCATION REACHED",
                        (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Display the frame
        cv2.imshow("Frame", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()