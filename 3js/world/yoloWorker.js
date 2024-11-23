self.onmessage = async (event) => {
    const { type, pixels, width, height } = event.data;

    if (type === 'process') {
        try {
            // Convert ImageData to raw pixel data (if needed)
            const payload = { pixels, width, height };
            console.log(pixels)

            // Send the data to the backend
            const response = await fetch('http://localhost:8000/predict/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Backend error: ${response.statusText}`);
            }

            const result = await response.json();

            // Post predictions back to the main thread
            postMessage({
                type: 'predictions',
                predictions: result.predictions,
                width,
                height,
            });
        } catch (error) {
            console.error('Error during backend inference:', error);
            postMessage({
                type: 'error',
                message: error.message,
            });
        }
    }
};