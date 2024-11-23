// ---------------------------------------------------------------- //
// heightmap-noise.js
// Generate a 3D moon scene of navigable terrain
// 1. Generates a noise function for soft slopes
// 2. Generates lighting surface normals and locations for potholes
//      TODO:
//    - Right now potholes are just perfect cones
//    - Surface normals only reflect a single light source I think
//    - Positioning the light sources would be helpful probably
// ---------------------------------------------------------------- //

import * as THREE from 'three';

import { LoopSubdivision } from 'https://unpkg.com/three-subdivide/build/index.module.js';

// import SubdivisionModifier from 'three/addons/modifiers/SubdivisionModifier.js'; // Import if available

/*================================================================

Setup

================================================================*/


// Create the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadow mapping
document.body.appendChild(renderer.domElement);

// Create a plane geometry to represent the heightmap
const width = 512; // Width of the heightmap
const height = 512; // Height of the heightmap
const geometry = new THREE.PlaneGeometry(width, height, width - 1, height - 1);

// Create a gray texture
const texture = new THREE.TextureLoader().load('../static/textures/regolith2.jpg'); // Replace with your texture path
const material = new THREE.MeshStandardMaterial({ map: texture, wireframe: false });
const plane = new THREE.Mesh(geometry, material);
plane.receiveShadow = true; // Make sure the plane can receive shadows
plane.rotation.x = -Math.PI / 2; // Rotate the plane to make it horizontal
scene.add(plane);

// // Create a canvas for noise display
// const noiseCanvas = document.getElementById('noiseCanvas');
// const noiseCtx = noiseCanvas.getContext('2d');
// SETUP AUTONOMOUS MODE
// Floating button panel for autonomous controls
const controlPanel = document.createElement('div');
controlPanel.id = 'control-panel';
controlPanel.style.position = 'fixed';
controlPanel.style.bottom = '20px';
controlPanel.style.left = '20px';
controlPanel.style.padding = '10px';
controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
controlPanel.style.borderRadius = '5px';
controlPanel.style.zIndex = '1000';
document.body.appendChild(controlPanel);

// Play button
const playButton = document.createElement('button');
playButton.innerText = 'Play';
playButton.style.marginRight = '10px';
playButton.onclick = togglePlay;
controlPanel.appendChild(playButton);

// Step Forward button
const stepButton = document.createElement('button');
stepButton.innerText = 'Step Forward';
stepButton.onclick = stepForward;
controlPanel.appendChild(stepButton);


let drivabilityScores = [];

/*================================================================

Generate HeightMap + Potholes + Rocks

================================================================*/
// Function to get the height safely
function getHeight(y, x) {
    // Ensure x and y are within the bounds of the heightmap
    if (x < 0 || x >= width || y < 0 || y >= height) {
        return 0; // Return 0 for out-of-bounds
    }
    return lastHeightmapData[x * width + y]; // Retrieve the height
}

// Function to calculate normals
function calculateNormals() {
    const normals = new Float32Array(width * height * 3); // Three components for x, y, z

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            // Get neighboring heights with correct bounds
            const hL = getHeight(i - 1, j);
            const hR = getHeight(i + 1, j);
            const hD = getHeight(i, j - 1);
            const hU = getHeight(i, j + 1);

            // Calculate normals
            const normalX = hL - hR;
            const normalY = hD - hU;
            const normalZ = 2.0; // This value can be adjusted for more or less steep normals

            // Normalize the normal vector
            const length = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);
            normals[(i * height + j) * 3] = normalX / length;
            normals[(i * height + j) * 3 + 1] = normalY / length;
            normals[(i * height + j) * 3 + 2] = normalZ / length;
        }
    }
    return normals;
}

// Variable to store the last generated heightmap
let lastHeightmapData = null;

function generateHeightmap() {
    const simplex = new SimplexNoise();
    const heightData = new Float32Array(width * height);

    // Create a flat base heightmap with subtle noise
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            // Generate smooth base height with lower noise scale
            heightData[i * width + j] = simplex.noise2D(i / 50, j / 50) * 1; // Subtle variations
        }
    }
    // ----------------------------------------------------------------
    // POTHOLE PARAMS
    // ----------------------------------------------------------------


    
    // Define pothole parameters
    const potholeCount = 4; // Number of potholes
    const minPotholeRadius = 20; // Minimum radius for potholes
    const maxPotholeRadius = 30; // Maximum radius for potholes
    const potholeDepthMultiplier = -20; // Depth multiplier for potholes

    // Introduce distinct potholes
    for (let k = 0; k < potholeCount; k++) {
        const potholeX = Math.floor(Math.random() * (width - 40)) + 20; // Avoid edges
        const potholeY = Math.floor(Math.random() * (height - 40)) + 20; // Avoid edges
        const potholeRadius = Math.floor(Math.random() * (maxPotholeRadius - minPotholeRadius + 1)) + minPotholeRadius; // Random radius between min and max

        for (let i = -potholeRadius; i <= potholeRadius; i++) {
            for (let j = -potholeRadius; j <= potholeRadius; j++) {
                const distance = Math.sqrt(i * i + j * j);
                if (distance < potholeRadius) {
                    const x = potholeX + i;
                    const y = potholeY + j;

                    // Check boundaries
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        // Create a sharper depth effect for potholes
                        const potholeDepth = potholeDepthMultiplier * (1 - (distance / potholeRadius)); // More noticeable depth
                        heightData[x * width + y] += potholeDepth; // Apply depth to height data
                    }
                }
            }
        }
    }

    // Store the generated heightmap data
    lastHeightmapData = heightData;

    // Update the plane geometry with the generated heights
    for (let i = 0; i < geometry.attributes.position.count; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        geometry.attributes.position.setZ(i, heightData[x * width + y]);
    }
    geometry.attributes.position.needsUpdate = true; // Notify Three.js that the positions have changed

    // Calculate and set the normals
    const normals = calculateNormals(heightData);
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}
const noise = new SimplexNoise();

function generateRocks() {
    const rockCount = 10; // Number of rocks to generate
    const minRockSize = 7; // Minimum size of rocks
    const maxRockSize = 20; // Maximum size of rocks

    for (let i = 0; i < rockCount; i++) {
        // Randomly size each rock
        const rockSize = Math.random() * (maxRockSize - minRockSize) + minRockSize;

        // Use IcosahedronGeometry for a natural polyhedral shape
        let rockGeometry = new THREE.IcosahedronGeometry(rockSize / 2, 1); // Lower initial detail level

        // Apply strong Perlin noise-based displacement for pronounced jaggedness
        const positionAttribute = rockGeometry.attributes.position;
        for (let j = 0; j < positionAttribute.count; j++) {
            const x = positionAttribute.getX(j);
            const y = positionAttribute.getY(j);
            const z = positionAttribute.getZ(j);

            // Intense noise for rugged, jagged look
            const noiseValue = noise.noise3D(x * 0.15, y * 0.15, z * 0.15);
            const displacement = noiseValue * rockSize * 0.3; // Higher displacement factor

            // Apply the displacement along the vertex's normal
            const nx = x + (x / rockSize) * displacement;
            const ny = y + (y / rockSize) * displacement;
            const nz = z + (z / rockSize) * displacement;

            positionAttribute.setXYZ(j, nx, ny, nz);
        }
        rockGeometry.computeVertexNormals();

        // Apply LoopSubdivision smoothing after displacement
        rockGeometry = LoopSubdivision.modify(rockGeometry, 1); // Apply one level of subdivision

        // Set a light gray color with slight variation for each rock
        const grayBase = 0xD3D3D3; // Light gray color
        const variation = Math.random() * 0.1 - 0.05;
        const rockColor = new THREE.Color(grayBase).offsetHSL(0, 0, variation);

        const rockMaterial = new THREE.MeshStandardMaterial({
            color: rockColor,
            roughness: 0.85 + Math.random() * 0.1,
            metalness: 0.05,
        });

        // Create the rock mesh
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.castShadow = true;

        // Apply non-uniform scaling for natural, irregular rock shapes
        rock.scale.set(
            1 + Math.random() * 0.2,
            1 + Math.random() * 0.2,
            1 + Math.random() * 0.2
        );

        // Randomly position each rock on the terrain
        const rockX = Math.random() * width - width / 2;
        const rockZ = Math.random() * height - height / 2;

        // Calculate height at the rock position from the heightmap
        const heightX = Math.floor((rockX + width / 2) / width * geometry.parameters.widthSegments);
        const heightZ = Math.floor((rockZ + height / 2) / height * geometry.parameters.heightSegments);
        const heightIndex = heightX * width + heightZ;
        const terrainHeight = lastHeightmapData ? lastHeightmapData[heightIndex] : 0;

        // Position the rock at the calculated height
        rock.position.set(rockX, terrainHeight - 5 + rockSize / 2, rockZ);

        // Add the rock to the scene
        scene.add(rock);
    }
}

generateRocks();

/*================================================================

Lights and Camera

================================================================*/

// Set up camera position
camera.position.set(128, 50, 128); // Position the camera above the heightmap
camera.lookAt(new THREE.Vector3(128, 0, 128));

// Add orbit controls
// const controls = new OrbitControls(camera, renderer.domElement);

// Add floodlights
const LIGHT_INTENSITY = .4;
const directionalLight1 = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY); // Increased intensity
directionalLight1.position.set(10, 20, 10).normalize(); // Higher position
directionalLight1.castShadow = true; // Enable shadow casting
directionalLight1.shadow.bias = -0.05; // Adjust shadow bias
directionalLight1.shadow.mapSize.width = 2048; // Increase shadow map width
directionalLight1.shadow.mapSize.height = 2048; // Increase shadow map height
scene.add(directionalLight1);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, LIGHT_INTENSITY); // Increased intensity
directionalLight2.position.set(-10, 20, 10).normalize(); // Higher position
directionalLight2.castShadow = true; // Enable shadow casting
directionalLight2.shadow.bias = -0.05; // Adjust shadow bias
directionalLight2.shadow.mapSize.width = 2048; // Increase shadow map width
directionalLight2.shadow.mapSize.height = 2048; // Increase shadow map height
scene.add(directionalLight2);


const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
scene.add(ambientLight);

// =================================================================
// GENERATE ARENA
// =================================================================

// 1. CYLINDER WALLS

// Function to create short wall cylinders
function createWalls() {
    console.log("Creating Walls");
    const wallHeight = 255; // Height of the walls (thickness)
    const wallRadius = 6.0; // Radius of the walls (length)
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Gray color

    // Create walls at the edges of the arena
    const wallPositions = [
        { side: 1, x: 0, z: -height / 2 }, // Bottom wall
        { side: 2, x: 0, z: height / 2 },  // Top wall
        { side: 3, x: -width / 2, z: 0 },  // Left wall
        { side: 4, x: width / 2, z: 0 }     // Right wall
    ];

    wallPositions.forEach(pos => {
        const wallGeometry = new THREE.CylinderGeometry(wallRadius, wallRadius, wallHeight, 32);
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(pos.x, wallHeight / 2, pos.z); // Position the wall
        wall.rotation.z = Math.PI / 2; // Rotate to lay it flat
        wall.position.y = 5;
        // Rotate based on wall side
        if (pos.side === 3 || pos.side === 4) {
            wall.rotation.y = Math.PI / 2; // Rotate for horizontal walls
        }
        
        wall.castShadow = true; // Enable shadow casting for the wall
        wall.receiveShadow = true; // Enable shadow receiving for the wall
        scene.add(wall);
    });

}

// =================================================================
// OBJECTS
// =================================================================


// Person for YOLO Testing
// // Load an image texture
// const imageLoader = new THREE.TextureLoader();
// const personTexture = imageLoader.load('../static/textures/girl.png', () => {
//     console.log('Person image loaded.');
// });

// // Create a plane with the image texture
// const personPlaneGeometry = new THREE.PlaneGeometry(100, 100); // Adjust size as needed
// const personPlaneMaterial = new THREE.MeshStandardMaterial({
//     map: personTexture,
//     side: THREE.DoubleSide, // Ensure the texture is visible on both sides
// });
// const personPlane = new THREE.Mesh(personPlaneGeometry, personPlaneMaterial);
// personPlane.position.set(0, 50, 0); // Adjust position as needed
// scene.add(personPlane);

// // Optional: Add lighting to better visualize the plane
// const planeLight = new THREE.PointLight(0xffffff, 1, 500);
// planeLight.position.set(50, 150, 50);
// scene.add(planeLight);

// // 2a. DROP SAMPLE BEACON CYAN
// function dropColorBlockBeaconCyan() {
//     const boxWidth = 10; // Width of the box
//     const boxHeight = 10; // Height of the box
//     const boxDepth = 2; // Depth of the box

//     // Create box geometry
//     const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

//     // Create materials for the box sides
//     const materials = [
//         new THREE.MeshStandardMaterial({ color: 0x00FFFF }), // Cyan
//         new THREE.MeshStandardMaterial({ color: 0x00FFFF }), // Cyan
//         new THREE.MeshStandardMaterial({ color: 0x00FFFF }), // Cyan
//         new THREE.MeshStandardMaterial({ color: 0x00FFFF }), // Cyan
//         new THREE.MeshStandardMaterial({ color: 0x00FFFF }), // Cyan
//         new THREE.MeshStandardMaterial({ color: 0x00FFFF })  // Cyan
//     ];

//     // Create a mesh with the geometry and the materials
//     const box = new THREE.Mesh(boxGeometry, materials);

//     // Position the box
//     box.position.set(100, 8, 122); // Adjust the position as needed

//     // Enable shadows if needed
//     box.castShadow = true; // Enable shadow casting for the box
//     box.receiveShadow = true; // Enable shadow receiving for the box

//     // Add the box to the scene
//     scene.add(box);
// }

// // 2b. DROP SAMPLE BEACON MAGENTA
// function dropColorBlockBeaconMagenta() {
//     const boxWidth = 10; // Width of the box
//     const boxHeight = 10; // Height of the box
//     const boxDepth = 2; // Depth of the box

//     // Create box geometry
//     const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

//     // Create materials for the box sides
//     const materials = [
//         new THREE.MeshStandardMaterial({ color: 0xFF00FF }), // Magenta
//         new THREE.MeshStandardMaterial({ color: 0xFF00FF }), // Magenta
//         new THREE.MeshStandardMaterial({ color: 0xFF00FF }), // Magenta
//         new THREE.MeshStandardMaterial({ color: 0xFF00FF }), // Magenta
//         new THREE.MeshStandardMaterial({ color: 0xFF00FF }), // Magenta
//         new THREE.MeshStandardMaterial({ color: 0xFF00FF })  // Magenta
//     ];

//     // Create a mesh with the geometry and the materials
//     const box = new THREE.Mesh(boxGeometry, materials);

//     // Position the box
//     box.position.set(122, 8, 80); // Adjust the position as needed
//     box.rotation.y = Math.PI/2;

//     // Enable shadows if needed
//     box.castShadow = true; // Enable shadow casting for the box
//     box.receiveShadow = true; // Enable shadow receiving for the box

//     // Add the box to the scene
//     scene.add(box);
// }



// ___________________
// 
// Generate the Arena
//
generateHeightmap();
// createWalls();
// dropColorBlockBeaconCyan()
// dropColorBlockBeaconMagenta()
// // ___________________

/*================================================================

Tools

================================================================*/

// Function to visualize the stored heightmap
function visualizeNoise() {
    if (!lastHeightmapData) return; // Check if heightmap data exists

    const imageData = noiseCtx.createImageData(width, height);
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            const heightValue = lastHeightmapData[i * width + j];
            const colorValue = ((heightValue + 15) / 15) * 255; // Normalize to 0-255 for visualization

            const index = (i + j * width) * 4;
            imageData.data[index] = colorValue; // Red
            imageData.data[index + 1] = colorValue; // Green
            imageData.data[index + 2] = colorValue; // Blue
            imageData.data[index + 3] = 255; // Alpha
        }
    }
    noiseCtx.putImageData(imageData, 0, 0);
}

// Event listener for button
// document.getElementById('generateNoiseBtn').addEventListener('click', visualizeNoise);

// Fixed height for the camera
const fixedHeight = 50;
camera.position.set(128, fixedHeight, 128); // Set initial camera position

// Variables to track camera movement and rotation speed
const moveSpeed = 1; // Adjust this value for speed of movement
const rotationSpeed = 0.01; // Adjust this value for speed of rotation

// Update the camera position and rotation based on key states
const keyState = {}; // To track which keys are pressed

// Event listeners for keydown and keyup to track key states
document.addEventListener('keydown', (event) => {
    event.preventDefault();
    keyState[event.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (event) => {
    event.preventDefault();
    keyState[event.key.toLowerCase()] = false;
});



function updateCamera() {
    // Get the forward and right directions based on the camera's orientation
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward); // Forward direction (relative to where the camera is pointing)
    
// Calculate the true right direction by crossing forward with the world up vector
const right = new THREE.Vector3();
right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize(); // Right on the horizontal plane
    

    // Camera movement with WASD keys relative to the camera's direction
    if (keyState['w']) {
        camera.position.add(forward.clone().multiplyScalar(moveSpeed)); // Move forward
    }
    if (keyState['s']) {
        camera.position.add(forward.clone().multiplyScalar(-moveSpeed)); // Move backward
    }
    if (keyState['a']) {
        camera.position.add(right.clone().multiplyScalar(-moveSpeed)); // Move left
    }
    if (keyState['d']) {
        camera.position.add(right.clone().multiplyScalar(moveSpeed)); // Move right
    }

    // Ensure the camera stays at a fixed height
    camera.position.y = fixedHeight;

    // Camera tilt and pan with arrow keys (relative to camera's local orientation)
    if (keyState['arrowup']) {
        camera.rotateX(rotationSpeed); // Tilt up
    }
    if (keyState['arrowdown']) {
        camera.rotateX(-rotationSpeed); // Tilt down
    }
    // Camera pan with arrow keys (relative to the horizontal plane, not affected by tilt)
    if (keyState['arrowleft']) {
        camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), rotationSpeed); // Pan left on world Y-axis
    }
    if (keyState['arrowright']) {
        camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -rotationSpeed); // Pan right on world Y-axis
    }
}
// [AUTONOMOUS DRIVE MODE] ----------------------------------------------------------------
let isPlaying = false;
let targetX = null;
const panSpeed = 0.01; // Adjust pan speed for smooth panning
const forwardDistance = 5; // Distance to move forward
let shouldPan = false; // Flag to control panning only when stepForward is called

// Toggle Play mode
function togglePlay() {
    isPlaying = !isPlaying;
    playButton.innerText = isPlaying ? 'Pause' : 'Play';
}

// Function to start panning to target path once
function startPanningToPath(bestPathIndex) {
    const sliceWidth = width / drivabilityScores.length;
    targetX = (bestPathIndex + 0.5) * sliceWidth - width / 2;
    shouldPan = true; // Enable panning
}

// Function to step forward by finding and centering the best path
function stepForward() {
    const bestPathIndex = findBestPath();
    if (bestPathIndex !== -1) {
        startPanningToPath(bestPathIndex);
    }
}

// Find the best path index based on drivability scores
function findBestPath() {
    if (!drivabilityScores.length) return -1;

    // Find the five adjacent slices with the highest combined drivability score
    let maxSum = -Infinity;
    let bestIndex = 0;
    for (let i = 0; i < drivabilityScores.length - 4; i++) { // Adjust loop to account for five slices
        const sum = drivabilityScores[i] + drivabilityScores[i + 1] + drivabilityScores[i + 2] + drivabilityScores[i + 3] + drivabilityScores[i + 4];
        if (sum > maxSum) {
            maxSum = sum;
            bestIndex = i + 2; // Center on the middle of the five slices
        }
    }
    return bestIndex;
}

// Smoothly pan the camera to center on the target X position
function updateCameraPanning() {
    if (targetX !== null && shouldPan) {
        // Calculate the difference in X and Z to the target position
        const deltaX = targetX - camera.position.x;
        const deltaZ = -10; // Assuming a fixed look-ahead distance on Z

        // Calculate the horizontal target angle on the Y-axis
        const targetAngle = Math.atan2(deltaX, deltaZ);

        // Calculate the difference between the current Y-axis rotation and target rotation
        let angleDifference = targetAngle - camera.rotation.y;

        // Normalize angleDifference to be within the range [-PI, PI]
        angleDifference = ((angleDifference + Math.PI) % (2 * Math.PI)) - Math.PI;

        // If the angle difference is small enough, finish panning
        if (Math.abs(angleDifference) < 1) { // Smaller tolerance for accuracy
            shouldPan = false; // Stop panning
            targetX = null; // Clear target
            moveCameraForward(); // Move forward once centered
        } else {
            // Apply incremental rotation towards the target
            const rotationStep = Math.sign(angleDifference) * panSpeed;
            camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -rotationStep);
        }
    }
}

// Move the camera forward by a set distance
function moveCameraForward() {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    camera.position.add(forward.multiplyScalar(forwardDistance)); // Move forward
}

// Update the camera in Play mode
function updateAutonomousMode() {
    if (isPlaying) {
        // If playing, repeatedly find and center the best path
        if (!shouldPan) {
            stepForward();
        }
        updateCameraPanning();
    } else if (shouldPan) {
        // If not playing, allow single-step panning when stepForward is called
        updateCameraPanning();
    }
}

// Modify the animate function to update the camera
function animate() {
    requestAnimationFrame(animate);
    updateCamera(); // Call the camera update function
    updateAutonomousMode(); // Autonomous camera updates
    renderer.render(scene, camera);
}

animate();

// Assume renderer is your THREE.WebGLRenderer
const canvas = renderer.domElement; // Access the main Three.js canvas

// Overlay div for displaying drivability guidelines directly
const guidelinesOverlay = document.createElement('div');
guidelinesOverlay.id = 'guidelines-overlay';
document.body.appendChild(guidelinesOverlay); // Add overlay div to DOM

// Function to adjust overlay size to match canvas
function adjustGuidelinesOverlay() {
    guidelinesOverlay.style.width = `${canvas.width}px`;
    guidelinesOverlay.style.height = `${canvas.height}px`;
    guidelinesOverlay.style.top = `${canvas.offsetTop}px`;
    guidelinesOverlay.style.left = `${canvas.offsetLeft}px`;
}

// Call this initially and on resize
window.addEventListener('resize', adjustGuidelinesOverlay);
adjustGuidelinesOverlay(); // Initial call

// Function to update drivability guidelines on overlay
function updateGuidelines(drivabilityScores) {
    guidelinesOverlay.innerHTML = ''; // Clear previous guidelines

    const numSlices = drivabilityScores.length;
    const sliceWidth = canvas.width / numSlices; // Use canvas width, not window
    const overlayHeight = canvas.height; // Use canvas height, not window

    // Find the three adjacent regions with the highest combined score
    let maxSum = -Infinity;
    let maxIndex = 0;
    for (let i = 0; i < numSlices - 2; i++) {
        const sum = drivabilityScores[i] + drivabilityScores[i + 1] + drivabilityScores[i + 2] + drivabilityScores[i + 3] + drivabilityScores[i + 4];
        if (sum > maxSum) {
            maxSum = sum;
            maxIndex = i;
        }
    }

    for (let i = 0; i < numSlices; i++) {
        // Create a div to represent each guideline region
        const region = document.createElement('div');
        region.className = 'guideline-region';
        region.style.width = `${sliceWidth}px`;
        region.style.height = `${overlayHeight}px`;
        region.style.left = `${i * sliceWidth}px`;
        region.style.position = 'absolute';
        region.style.top = '0';

        // Highlight the three adjacent regions with the highest scores
        if (i >= maxIndex && i < maxIndex + 5) {
            region.style.backgroundColor = 'rgba(173, 216, 230, 0.2)'; // Light blue with low opacity
        }

        // Create line for slice boundary
        const line = document.createElement('div');
        line.className = 'guideline-line';
        line.style.left = `${(i + 1) * sliceWidth}px`;
        line.style.height = `${overlayHeight}px`;
        guidelinesOverlay.appendChild(line);

        // Create score label
        const score = document.createElement('span');
        score.className = 'guideline-score';
        score.innerText = drivabilityScores[i].toFixed(2);
        score.style.left = `${i * sliceWidth + sliceWidth / 2}px`;
        score.style.top = `${overlayHeight / 3}px`;
        guidelinesOverlay.appendChild(score);

        // Append region div for background color
        guidelinesOverlay.appendChild(region);
    }
}

// Main script
const cvWorker = new Worker('/static/opencvWorker.js');

// Handle message from the worker
cvWorker.onmessage = function (event) {
    drivabilityScores = event.data.drivabilityScores;
    updateGuidelines(drivabilityScores); // Update guidelines with the processed scores
};

// After WebGL initialization
setupOverlay();

// Function to process the WebGL canvas
async function processCanvas() {
    const canvas = renderer.domElement; // WebGL canvas
    const width = canvas.width;
    const height = canvas.height;

    // Read pixel data for OpenCV
    const gl = renderer.getContext();
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip the pixel data vertically
    flipPixelsVertically(pixels, width, height);

    // Send pixel data to OpenCV and YOLO workers
    cvWorker.postMessage({ type: 'process', pixels, width, height });
    // Resize pixel data to 640x640 for YOLO using bilinear interpolation
    const resizedPixels = resizePixelsBilinear(pixels, width, height, 640, 640);

    // Send resized pixel data to the backend
    try {
        const response = await fetch("http://localhost:8000/predict/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                width: 640,
                height: 640,
                pixels: Array.from(resizedPixels),
            }),
        });

        const data = await response.json();
        if (data.error) {
            console.error("Backend Error:", data.error);
        } else {
            console.log("Predictions:", data.predictions);
            const overlayCanvas = document.getElementById('yolo-overlay');
            visualizePredictions(data.predictions, overlayCanvas.width, overlayCanvas.height, 640);
        }
    } catch (error) {
        console.error("Error sending data to backend:", error);
    }
}


// Function to flip the pixel data vertically
// Correct difference with webgl origin coordinates
function flipPixelsVertically(pixels, width, height) {
    const bytesPerRow = width * 4; // 4 bytes per pixel (RGBA)
    const tempRow = new Uint8Array(bytesPerRow);

    for (let row = 0; row < height / 2; row++) {
        const topRow = row * bytesPerRow;
        const bottomRow = (height - row - 1) * bytesPerRow;

        // Swap rows
        tempRow.set(pixels.subarray(topRow, topRow + bytesPerRow));
        pixels.set(pixels.subarray(bottomRow, bottomRow + bytesPerRow), topRow);
        pixels.set(tempRow, bottomRow);
    }
}

function resizePixelsBilinear(sourcePixels, sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const targetPixels = new Uint8Array(targetWidth * targetHeight * 4); // RGBA format

    const xRatio = sourceWidth / targetWidth;
    const yRatio = sourceHeight / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const targetIndex = (y * targetWidth + x) * 4;

            // Calculate source coordinates
            const srcX = x * xRatio;
            const srcY = y * yRatio;

            // Get the integer and fractional parts of the source coordinates
            const x0 = Math.floor(srcX);
            const x1 = Math.min(x0 + 1, sourceWidth - 1);
            const y0 = Math.floor(srcY);
            const y1 = Math.min(y0 + 1, sourceHeight - 1);

            const dx = srcX - x0;
            const dy = srcY - y0;

            // Perform bilinear interpolation for each color channel (R, G, B, A)
            for (let channel = 0; channel < 4; channel++) {
                const c00 = sourcePixels[(y0 * sourceWidth + x0) * 4 + channel];
                const c01 = sourcePixels[(y0 * sourceWidth + x1) * 4 + channel];
                const c10 = sourcePixels[(y1 * sourceWidth + x0) * 4 + channel];
                const c11 = sourcePixels[(y1 * sourceWidth + x1) * 4 + channel];

                // Interpolate
                const value =
                    c00 * (1 - dx) * (1 - dy) +
                    c01 * dx * (1 - dy) +
                    c10 * (1 - dx) * dy +
                    c11 * dx * dy;

                targetPixels[targetIndex + channel] = value;
            }
        }
    }

    return targetPixels;
}

// Function to save ImageData to a file
function saveImageData(imageData) {
    // Create a temporary canvas
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;

    // Put ImageData onto the canvas
    ctx.putImageData(imageData, 0, 0);

    // Convert the canvas to a Blob and save it
    tempCanvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'webgl_image.png'; // File name
        link.click();
    }, 'image/png');
}

function initializeYoloOverlay() {
    // Create YOLO overlay canvas dynamically
    let overlayCanvas = document.getElementById('yolo-overlay');
    if (!overlayCanvas) {
        overlayCanvas = document.createElement('canvas');
        overlayCanvas.id = 'yolo-overlay';
        document.body.appendChild(overlayCanvas);
    }

    // Style the overlay canvas
    overlayCanvas.style.position = 'absolute';
    overlayCanvas.style.top = '0';
    overlayCanvas.style.left = '0';
    overlayCanvas.style.pointerEvents = 'none'; // Prevent user interaction
    overlayCanvas.style.zIndex = '10'; // Ensure it overlays other elements
}

function adjustYoloOverlay() {
    const overlayCanvas = document.getElementById('yolo-overlay');
    const webglCanvas = renderer.domElement;

    // Match size and position with the WebGL canvas
    overlayCanvas.width = webglCanvas.width;
    overlayCanvas.height = webglCanvas.height;

    const rect = webglCanvas.getBoundingClientRect();
    overlayCanvas.style.top = `${rect.top}px`;
    overlayCanvas.style.left = `${rect.left}px`;
}

// Call this function once WebGL is initialized
function setupOverlay() {
    initializeYoloOverlay();
    adjustYoloOverlay();

    // Adjust the overlay dynamically on window resize
    window.addEventListener('resize', adjustYoloOverlay);
}

// Visualize YOLO Predictions// Visualize YOLO Predictions
function visualizePredictions(predictions, canvasWidth, canvasHeight, yoloInputSize = 640) {
    const overlayCanvas = document.getElementById('yolo-overlay');
    const ctx = overlayCanvas.getContext('2d');

    // Clear previous drawings
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    predictions.forEach((pred) => {
        const { box, score, class: classIndex } = pred;
        const [x1, y1, x2, y2] = box; // Bounding box in YOLO input size

        // Scale bounding box to the canvas size
        const scaledX1 = (x1 / yoloInputSize) * canvasWidth;
        const scaledY1 = (y1 / yoloInputSize) * canvasHeight;
        const scaledX2 = (x2 / yoloInputSize) * canvasWidth;
        const scaledY2 = (y2 / yoloInputSize) * canvasHeight;

        const width = scaledX2 - scaledX1;
        const height = scaledY2 - scaledY1;

        // Draw bounding box
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(scaledX1, scaledY1, width, height);

        // Add label
        ctx.fillStyle = 'red';
        ctx.font = '16px Arial';
        ctx.fillText(
            `Class: ${classIndex}, Score: ${score.toFixed(2)}`,
            scaledX1,
            scaledY1 - 5
        );
    });
}

// Adjust the YOLO overlay on window resize
window.addEventListener('resize', adjustYoloOverlay);
adjustYoloOverlay(); // Initial adjustment


// Call processCanvas periodically or on demand
setInterval(processCanvas, 1000); // Or integrate with your animate pipeline

// // Ensure OpenCV.js is ready before running
// function openCvReady() {
//     cv['onRuntimeInitialized'] = () => {
//         cv.FS_createPath("/", "working", true, true);
//         setInterval(processCanvas, 10); // Run processing every 500 ms
//     };
// }
// openCvReady();