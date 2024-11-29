// ---------------------------------------------------------------- //
// world.js
// Generate a 3D moon scene of navigable terrain
// 1. Generates a noise function for soft slopes
// 2. Generates lighting surface normals and locations for potholes
// ---------------------------------------------------------------- //

import * as THREE from 'three';

import { LoopSubdivision } from 'https://unpkg.com/three-subdivide/build/index.module.js';

/*================================================================

Setup

================================================================*/
let predictions = []; // Global variable to store YOLO predictions
let drivabilityScores = [];

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

// Create a gray texture for the Environment base
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

/*================================================================

Control Panel

// ================================================================*/
// // Floating button panel for autonomous controls
// // Add Font Awesome stylesheet for icons (add this to your HTML head or dynamically in JS)
// const fontAwesomeLink = document.createElement('link');
// fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
// fontAwesomeLink.rel = 'stylesheet';
// document.head.appendChild(fontAwesomeLink);

// // Create the control panel container
// const controlPanel = document.createElement('div');
// controlPanel.id = 'control-panel';
// controlPanel.style.position = 'fixed';
// controlPanel.style.top = '20px';
// controlPanel.style.left = '20px';
// controlPanel.style.padding = '10px';
// controlPanel.style.background = 'linear-gradient(135deg, rgba(0, 10, 30, 0.9), rgba(0, 60, 90, 0.9))';
// controlPanel.style.borderRadius = '10px';
// controlPanel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
// controlPanel.style.zIndex = '1000';
// controlPanel.style.display = 'flex';
// controlPanel.style.gap = '10px';
// document.body.appendChild(controlPanel);

// // Utility function to create buttons with icons
// function createIconButton(iconClass, title, onClick) {
//     const button = document.createElement('button');
//     button.title = title; // Tooltip text
//     button.style.width = '20px';
//     button.style.height = '20px';
//     button.style.border = 'none';
//     button.style.borderRadius = '50%';
//     button.style.background = 'rgba(255, 255, 255, 0.1)';
//     button.style.color = 'white';
//     button.style.display = 'flex';
//     button.style.alignItems = 'center';
//     button.style.justifyContent = 'center';
//     button.style.cursor = 'pointer';
//     button.style.transition = 'background 0.3s';
//     button.onmouseover = () => (button.style.background = 'rgba(255, 255, 255, 0.2)');
//     button.onmouseout = () => (button.style.background = 'rgba(255, 255, 255, 0.1)');
//     button.onclick = onClick;

//     const icon = document.createElement('i');
//     icon.className = iconClass; // Font Awesome class for the icon
//     icon.style.fontSize = '20px';
//     button.appendChild(icon);

//     return button;
// }

// // Play button
// const playButton = createIconButton('fas fa-play', 'Play', togglePlay);
// controlPanel.appendChild(playButton);

// // Step Forward button
// const stepButton = createIconButton('fas fa-forward', 'Step Forward', stepForward);
// controlPanel.appendChild(stepButton);

// // Toggle Guidelines button
// const toggleGuidelinesButton = createIconButton('fas fa-person-walking', 'Toggle Guidelines', toggleGuidelines);
// controlPanel.appendChild(toggleGuidelinesButton);

// // Toggle YOLO Processing button
// const toggleYoloButton = createIconButton('fas fa-crosshairs', 'Toggle YOLO Processing', toggleYoloProcessing);
// controlPanel.appendChild(toggleYoloButton);

/*================================================================

Stats Panel

================================================================*/
// Create the stats panel container
const statsPanel = document.createElement('div');
statsPanel.id = 'stats-panel';
statsPanel.style.position = 'fixed';
statsPanel.style.top = '20px';
statsPanel.style.left = '20px';
statsPanel.style.padding = '10px';
statsPanel.style.background = 'linear-gradient(135deg, rgba(0, 10, 30, 0.9), rgba(0, 60, 90, 0.9))';
statsPanel.style.borderRadius = '10px';
statsPanel.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.5)';
statsPanel.style.zIndex = '1000';
statsPanel.style.color = 'white';
statsPanel.style.fontFamily = 'Arial, sans-serif';
statsPanel.style.fontSize = '14px';
statsPanel.style.lineHeight = '1.5';
document.body.appendChild(statsPanel);

let visualizationTime = 0; // Variable to store the time taken for visualization

// Utility function to update stats
function updateStats(distanceToGoal, inferenceSpeed) {
    statsPanel.innerHTML = `
        <div><strong>Distance to Goal:</strong> ${distanceToGoal.toFixed(2)} m</div>
        <div><strong>Inference Speed:</strong> ${inferenceSpeed.toFixed(2)} ms</div>
    `;
}

// Calculate the distance to the goal
function calculateDistanceToGoal(camera, goalMarker) {
    if (!goalMarker) return 0;
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    return (cameraPosition.distanceTo(goalMarker.position) / 40) - 1;
}

// Measure inference speed
let inferenceStartTime = 0;
let inferenceSpeed = 0;

function startInferenceTimer() {
    inferenceStartTime = performance.now();
}

function stopInferenceTimer() {
    const inferenceEndTime = performance.now();
    inferenceSpeed = inferenceEndTime - inferenceStartTime;
}

// Update stats periodically
setInterval(() => {
    const distanceToGoal = calculateDistanceToGoal(camera, goalMarker);
    updateStats(distanceToGoal, inferenceSpeed);
}, 500); // Update every 500ms

// ----------------------------------------------------------------
// GOAL MARKER
// ----------------------------------------------------------------

// Variables for the goal marker
let goalMarker = null;

function createDiamondMarker() {
    // Create the upper cone
    const upperConeGeometry = new THREE.ConeGeometry(5, 10, 4); // Base radius: 5, Height: 10, 4-sided cone
    const upperConeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Bright green
    const upperCone = new THREE.Mesh(upperConeGeometry, upperConeMaterial);

    // Create the lower cone
    const lowerConeGeometry = new THREE.ConeGeometry(5, 10, 4); // Same dimensions as the upper cone
    const lowerCone = new THREE.Mesh(lowerConeGeometry, upperConeMaterial);

    // Flip the lower cone to point upwards
    lowerCone.rotation.x = Math.PI;
    lowerCone.position.y = 10; // Position the lower cone below the upper cone

    // Group the two cones together
    const diamond = new THREE.Group();
    // diamond.add(upperCone);
    diamond.add(lowerCone);

    return diamond;
}

// Function to place the goal at a specific position
function placeGoalAt(x, z) {
    console.log('Placing goal...');

    // If a goal marker already exists, remove it
    if (goalMarker) {
        scene.remove(goalMarker);
    }

    // Create a new diamond-shaped goal marker
    goalMarker = createDiamondMarker();

    // Calculate the height at the goal position
    const heightX = Math.floor((x + width / 2) / width * geometry.parameters.widthSegments);
    const heightZ = Math.floor((z + height / 2) / height * geometry.parameters.heightSegments);
    const heightIndex = heightX * width + heightZ;
    const terrainHeight = lastHeightmapData ? lastHeightmapData[heightIndex] : 0;

    // Position the goal marker
    goalMarker.position.set(x, terrainHeight + 5, z); // Slightly above the terrain
    goalMarker.castShadow = true;

    // Add the goal marker to the scene
    scene.add(goalMarker);

    console.log(`Goal placed at X: ${x}, Z: ${z}`);
}

// Event listener to handle mouse clicks for placing the goal
function onSceneClick(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Use raycaster to determine intersection with the terrain
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Check for intersections with the plane
    const intersects = raycaster.intersectObject(plane);

    if (intersects.length > 0) {
        const { x, z } = intersects[0].point; // Get the intersection point
        placeGoalAt(x, z); // Place the goal at the clicked position
    }
}

// Add event listener for mouse clicks
window.addEventListener('click', onSceneClick);
// State variables for toggling features
let showGuidelines = true;
let yoloProcessingActive = true;

// Function to toggle guidelines visibility
function toggleGuidelines() {
    const guidelinesOverlay = document.getElementById('guidelines-overlay');
    // Toggle visibility
    showGuidelines = !showGuidelines;
    if (showGuidelines) {
        guidelinesOverlay.style.display = 'block'; // Make visible
        guidelinesOverlay.style.visibility = 'visible';
        guidelinesOverlay.style.opacity = '1';
    } else {
        guidelinesOverlay.style.display = 'none'; // Hide
        guidelinesOverlay.style.visibility = 'hidden';
        guidelinesOverlay.style.opacity = '0';
    }
}

// Function to toggle YOLO processing
function toggleYoloProcessing() {
    const yoloOverlay = document.getElementById('yolo-overlay');
    // Toggle visibility
    yoloProcessingActive = !yoloProcessingActive;
    if (yoloProcessingActive) {
        yoloOverlay.style.display = 'block'; // Make visible
        yoloOverlay.style.visibility = 'visible';
        yoloOverlay.style.opacity = '1';
    } else {
        yoloOverlay.style.display = 'none'; // Hide
        yoloOverlay.style.visibility = 'hidden';
        yoloOverlay.style.opacity = '0';
    }
}
// ----------------------------------------------------------------
// MINIMAP
// ----------------------------------------------------------------
// Create the minimap canvas
const minimapCanvas = document.createElement('canvas');
minimapCanvas.id = 'minimap-canvas';
minimapCanvas.style.position = 'absolute';
minimapCanvas.style.top = '20px';
minimapCanvas.style.right = '20px';
minimapCanvas.style.width = '200px'; // Display size
minimapCanvas.style.height = '200px';
// minimapCanvas.style.border = '2px solid white'; // Optional border for styling
minimapCanvas.style.zIndex = '1000'; // Ensure it's above the main canvas
document.body.appendChild(minimapCanvas);

// Set up the minimap context
const minimapCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = 512; // Internal resolution for sharp rendering
minimapCanvas.height = 512;

// Render gridlines on the minimap
function renderGridlines() {
    const gridSize = 32; // Size of each grid cell in world coordinates
    const minimapGridSize = minimapCanvas.width / (width / gridSize); // Scaled grid size for minimap

    minimapCtx.strokeStyle = 'rgba(200, 200, 200, 0.5)'; // Light gray gridlines
    minimapCtx.lineWidth = 1;

    // Draw vertical gridlines
    for (let x = 0; x <= minimapCanvas.width; x += minimapGridSize) {
        minimapCtx.beginPath();
        minimapCtx.moveTo(x, 0);
        minimapCtx.lineTo(x, minimapCanvas.height);
        minimapCtx.stroke();
    }

    // Draw horizontal gridlines
    for (let y = 0; y <= minimapCanvas.height; y += minimapGridSize) {
        minimapCtx.beginPath();
        minimapCtx.moveTo(0, y);
        minimapCtx.lineTo(minimapCanvas.width, y);
        minimapCtx.stroke();
    }
}
function renderCameraMarker() {
    // Map camera position from world space to minimap space
    const camX = ((camera.position.x + width / 2) / width) * minimapCanvas.width;
    const camY = ((camera.position.z + height / 2) / height) * minimapCanvas.height; // No need to invert the Z-axis

    // Get and normalize camera direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // Flatten direction to XZ plane
    forward.normalize();

    // Size of the direction indicator
    const markerSize = 15;

    // Calculate the triangle points
    const tipX = camX + forward.x * markerSize;
    const tipY = camY + forward.z * markerSize; // Correct orientation

    // Calculate base points perpendicular to direction
    const baseWidth = markerSize * 0.5;
    const leftX = camX - forward.z * baseWidth;
    const leftY = camY + forward.x * baseWidth; // Adjusted for flipped Y-axis
    const rightX = camX + forward.z * baseWidth;
    const rightY = camY - forward.x * baseWidth; // Adjusted for flipped Y-axis

    // Draw the marker
    minimapCtx.save();
    minimapCtx.fillStyle = 'blue';
    minimapCtx.strokeStyle = 'blue';
    minimapCtx.lineWidth = 1;

    // Draw filled triangle
    minimapCtx.beginPath();
    minimapCtx.moveTo(tipX, tipY);
    minimapCtx.lineTo(leftX, leftY);
    minimapCtx.lineTo(rightX, rightY);
    minimapCtx.closePath();
    minimapCtx.fill();
    minimapCtx.stroke();

    minimapCtx.restore();
}


// Function to render the goal marker on the minimap
function renderGoalOnMinimap() {
    if (!goalMarker) return; // Skip if no goal marker exists

    // Map goal position from world space to minimap space
    const goalX = ((goalMarker.position.x + width / 2) / width) * minimapCanvas.width;
    const goalY = ((goalMarker.position.z + height / 2) / height) * minimapCanvas.height;

    // Draw goal marker on the minimap
    minimapCtx.save();
    minimapCtx.fillStyle = 'green'; // Bright green for the goal marker
    minimapCtx.beginPath();
    minimapCtx.arc(goalX, goalY, 5, 0, 2 * Math.PI); // Small circle
    minimapCtx.fill();
    minimapCtx.restore();
}

// Update the minimap in the animation loop
function updateMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height); // Clear the minimap
    renderGridlines(); // Draw gridlines
    renderCameraMarker(); // Draw the camera marker and view direction
    renderGoalOnMinimap();

    // Use global predictions to visualize obstacles on the minimap
    predictions.forEach((pred) => {
        plotObstacleOnMinimap(pred, camera, canvas.width, canvas.height, 640);
    });
}

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

function updateGuidelines(drivabilityScores, obstacles, goalPosition) {
    if (!showGuidelines) return; // Skip updates if guidelines are hidden
    guidelinesOverlay.innerHTML = ''; // Clear previous guidelines

    const numSlices = drivabilityScores.length;
    const sliceWidth = canvas.width / numSlices; // Width of each slice on the canvas
    const overlayHeight = canvas.height; // Full height of the overlay
    const sliceWidthWorld = width / numSlices; // Slice width in world coordinates

    // Convert obstacles to screen space
    const screenSpaceObstacles = obstacles.map((obstacle) => {
        const screenPos = new THREE.Vector3(obstacle.position.x, obstacle.position.y, obstacle.position.z).project(camera);
        return {
            x: ((screenPos.x + 1) / 2) * canvas.width,
            y: ((-screenPos.y + 1) / 2) * canvas.height,
            z: screenPos.z, // Keep the projected Z-coordinate for depth comparison
        };
    });

    // Update drivability scores with obstacles in screen space
    screenSpaceObstacles.forEach((obstacle) => {
        const sliceIndex = Math.floor(obstacle.x / sliceWidth);
        if (sliceIndex >= 0 && sliceIndex < numSlices) {
            // Calculate the penalty weight based on proximity to the camera
            const proximityWeight = Math.max(0, 1 - obstacle.y / canvas.height); // Closer obstacles have higher weights
            const penalty = proximityWeight * proximityWeight + .05 ; // Scale penalty by weight

            // Apply penalty to the slice containing the obstacle
            drivabilityScores[sliceIndex] -= penalty;

            // Optionally penalize adjacent slices with reduced penalty
            const adjacentPenalty = 0.1 * proximityWeight;
            if (sliceIndex - 1 >= 0) drivabilityScores[sliceIndex - 1] -= adjacentPenalty;
            if (sliceIndex + 1 < numSlices) drivabilityScores[sliceIndex + 1] -= adjacentPenalty;
        }
    });

    // Convert goal position to screen space
    let goalScreenPos = null;
    if (goalPosition) {
        goalScreenPos = new THREE.Vector3(goalPosition.x, goalPosition.y, goalPosition.z).project(camera);
        goalScreenPos = {
            x: ((goalScreenPos.x + 1) / 2) * canvas.width,
            y: ((-goalScreenPos.y + 1) / 2) * canvas.height,
        };
    }

    // Boost scores based on proximity to the goal in screen space
    if (goalScreenPos) {
        let closestSliceIndex = -1;
        let closestDistance = Infinity;

        for (let i = 0; i < numSlices; i++) {
            const sliceCenterX = (i + 0.5) * sliceWidth; // Center of the slice in screen space
            const distanceToGoal = Math.abs(sliceCenterX - goalScreenPos.x); // Only consider horizontal distance

            // Apply a stronger boost for closer slices
            const weight = 0.; // Adjust weight to emphasize goal proximity
            drivabilityScores[i] += Math.max(1 - distanceToGoal / canvas.width, 0) * weight;

            // Track the closest slice to the goal
            if (distanceToGoal < closestDistance) {
                closestDistance = distanceToGoal;
                closestSliceIndex = i;
            }
        }

        // Add a flat gain to the closest slice
        if (closestSliceIndex >= 0) {
            const flatGain = 0.1; // Adjust this value to control the flat gain
            drivabilityScores[closestSliceIndex] += flatGain;
        }
    }

    // Find the best 5-slice region index based on updated drivability scores
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < numSlices - 4; i++) { // Loop until numSlices - 4 for 5 slices
        const sum = drivabilityScores[i] + drivabilityScores[i + 1] + drivabilityScores[i + 2] + drivabilityScores[i + 3] + drivabilityScores[i + 4];
        if (sum > bestScore) {
            bestScore = sum;
            bestIndex = i; // Start index of the best region
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

        // Highlight the best path (5 slices)
        if (i >= bestIndex && i < bestIndex + 5) {
            region.style.backgroundColor = 'rgba(0, 255, 255, 0.1)'; // Cyan for best path
        }

        //         // // Create score label
//         // const score = document.createElement('span');
//         // score.className = 'guideline-score';
//         // score.innerText = drivabilityScores[i].toFixed(2);
//         // score.style.left = `${i * sliceWidth + sliceWidth / 2}px`;
//         // score.style.top = `${overlayHeight / 3}px`;
//         // guidelinesOverlay.appendChild(score);

        guidelinesOverlay.appendChild(region);
    }
}

// Main script
const cvWorker = new Worker('/static/opencvWorker.js');

// Handle message from the worker
cvWorker.onmessage = function (event) {
    drivabilityScores = event.data.drivabilityScores;

    // Convert YOLO predictions to 3D world positions
    const obstacles = predictions.map(pred => ({
        position: getObstacleWorldPosition(pred, camera, canvas.width, canvas.height)
    })).filter(obstacle => obstacle.position);

    // Get goal position
    const goalPosition = goalMarker ? goalMarker.position : null;

    // Update guidelines with the processed scores
    updateGuidelines(drivabilityScores, obstacles, goalPosition)
};

// After WebGL initialization
setupOverlay();

// Declare variables for flipped dimensions
let flippedWidth = 0;
let flippedHeight = 0;

// Instantiate the pixel worker
const pixelWorker = new Worker('/static/pixelWorker.js');

// Handle messages from the worker
pixelWorker.onmessage = function (event) {
    const { type, pixels } = event.data;
    
    if (type === 'flipped') {
        console.log('Pixels flipped:', pixels);

        // Proceed to resizing after flipping is complete
        if (yoloProcessingActive) {
            pixelWorker.postMessage({
                type: 'resize',
                data: { sourcePixels: pixels, sourceWidth: flippedWidth, sourceHeight: flippedHeight, targetWidth: 640, targetHeight: 640 },
            });
        }
    }

    if (type === 'resized') {
        console.log('Pixels resized:', pixels);
    
        // Prepare the binary frame data
        const frameWidth = 640;
        const frameHeight = 640;
    
        // Create an ArrayBuffer to hold width, height, and pixel data
        const buffer = new ArrayBuffer(8 + pixels.length); // 4 bytes each for width and height
        const view = new DataView(buffer);
    
        // Pack width and height as 32-bit integers
        view.setUint32(0, frameWidth); // Width at byte offset 0
        view.setUint32(4, frameHeight); // Height at byte offset 4
    
        // Append pixel data starting at byte offset 8
        const pixelData = new Uint8Array(buffer, 8);
        pixelData.set(pixels);
    
        // Send the binary frame data over WebSocket
        if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(buffer);
            console.log('Binary frame data sent to WebSocket');
        }
    }
};

// Establish WebSocket connection
const websocket = new WebSocket("ws://localhost:8000/ws/predict");

websocket.onopen = () => {
    console.log("WebSocket connection established");
};

websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.error) {
        console.error("Error from WebSocket:", data.error);
    } else {
        // Update the global predictions variable
        predictions = data.predictions;
        stopInferenceTimer();

        // Update YOLO visualization and minimap
        const overlayCanvas = document.getElementById('yolo-overlay');
        visualizePredictions(overlayCanvas.width, overlayCanvas.height, 640);
        updateMinimap(); // Update minimap with the latest predictions
    }
};

websocket.onerror = (error) => {
    console.error("WebSocket error:", error);
};

websocket.onclose = () => {
    console.log("WebSocket connection closed");
};

// Variables to track the camera's last known state
let lastCameraPosition = new THREE.Vector3();
let lastCameraQuaternion = new THREE.Quaternion();
let cameraMoved = false;

// Function to check if the camera has moved
function hasCameraMoved() {
    const currentPosition = new THREE.Vector3();
    const currentQuaternion = new THREE.Quaternion();

    camera.getWorldPosition(currentPosition); // Get current position
    camera.getWorldQuaternion(currentQuaternion); // Get current orientation

    // Check if position or orientation has changed
    cameraMoved =
        !currentPosition.equals(lastCameraPosition) ||
        !currentQuaternion.equals(lastCameraQuaternion);

    // Update the last known position and orientation
    lastCameraPosition.copy(currentPosition);
    lastCameraQuaternion.copy(currentQuaternion);

    return cameraMoved;
}
let isProcessingYOLO = false;

// Function to process the WebGL canvas
async function processCanvas() {
    if (!showGuidelines && !yoloProcessingActive) return;

    // Check if the camera has moved
    if (!hasCameraMoved()) {
        console.log("Camera has not moved. Skipping YOLO processing.");
        return; // Skip processing if the camera hasn't moved
    }
    
    if (isProcessingYOLO) return; // Ensure only one process is active at a time
    isProcessingYOLO = true;

    try {
        startInferenceTimer();

        const canvas = renderer.domElement; // WebGL canvas
        const width = canvas.width;
        const height = canvas.height;

        const gl = renderer.getContext();
        const rgbaPixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgbaPixels);
        // Convert RGBA to grayscale
        const grayscalePixels = new Uint8Array(width * height);
        for (let i = 0; i < rgbaPixels.length; i += 4) {
            // Use luminance formula to compute grayscale value
            const r = rgbaPixels[i];
            const g = rgbaPixels[i + 1];
            const b = rgbaPixels[i + 2];
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            grayscalePixels[i / 4] = gray; // Store the grayscale value
        }

        // Update flipped dimensions
        flippedWidth = width;
        flippedHeight = height;

        // Send grayscale data to the pixelWorker
        pixelWorker.postMessage({ type: 'flip', data: { pixels: grayscalePixels, width, height } });

        // Send grayscale data to the cvWorker if guidelines are enabled
        if (showGuidelines) {
            cvWorker.postMessage({ type: 'process', pixels: grayscalePixels, width, height });
        }

        console.log("YOLO Processing Active:", yoloProcessingActive);
    } catch (error) {
        console.error("Error processing canvas:", error);
    } finally {
        isProcessingYOLO = false; // Reset the flag
        updateMinimap(); // Minimap render
    }
}

// Debug Function to save ImageData to a file
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
function plotObstacleOnMinimap(prediction, camera, canvasWidth, canvasHeight, yoloInputSize = 640) {
    // Get bounding box center in YOLO input coordinates
    const [x1, y1, x2, y2] = prediction.box;
    const objectCenterX = (x1 + x2) / 2;
    const objectCenterY = (y1 + y2) / 2;

    // Scale to canvas size
    const scaledX = (objectCenterX / yoloInputSize) * canvasWidth;
    const scaledY = (objectCenterY / yoloInputSize) * canvasHeight;

    // Convert to NDC (Normalized Device Coordinates)
    const ndcX = (scaledX / canvasWidth) * 2 - 1;
    const ndcY = -(scaledY / canvasHeight) * 2 + 1;

    // Create ray from camera through the point
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    // Define ground plane
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y = 0

    // Find intersection with the ground plane
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

    // If no intersection is found, return
    if (!intersectionPoint) {
        console.warn('No intersection found with ground plane');
        return;
    }

    // Convert world position to minimap coordinates
    const minimapX = ((intersectionPoint.x + width / 2) / width) * minimapCanvas.width;
    const minimapY = ((intersectionPoint.z + height / 2) / height) * minimapCanvas.height;
    
    // Draw on minimap
    minimapCtx.save();
    minimapCtx.fillStyle = 'red'; // Obstacle color
    minimapCtx.fillRect(minimapX, minimapY, 20,20); // Draw a small circle
    minimapCtx.restore();
}
// Function to convert YOLO bounding box to 3D world position
function getObstacleWorldPosition(prediction, camera, canvasWidth, canvasHeight, yoloInputSize = 640) {
    const [x1, y1, x2, y2] = prediction.box;
    const objectCenterX = (x1 + x2) / 2;
    const objectCenterY = (y1 + y2) / 2;

    const scaledX = (objectCenterX / yoloInputSize) * canvasWidth;
    const scaledY = (objectCenterY / yoloInputSize) * canvasHeight;

    const ndcX = (scaledX / canvasWidth) * 2 - 1;
    const ndcY = -(scaledY / canvasHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y = 0
    const intersectionPoint = new THREE.Vector3();

    if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
        return intersectionPoint;
    }
    return null;
}

// 1 ms
function visualizePredictions(canvasWidth, canvasHeight, yoloInputSize = 640) {
    const overlayCanvas = document.getElementById('yolo-overlay');
    const ctx = overlayCanvas.getContext('2d');

    // Prepare the canvas for drawing
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Pre-compute scaling factors
    const xScale = canvasWidth / yoloInputSize;
    const yScale = canvasHeight / yoloInputSize;

    // Define class labels and colors
    const classLabels = ['Hole', 'Rock'];
    const classColors = {
        0: 'rgba(75, 163, 251, 0.8)', // Darker blue for holes
        1: 'rgba(0, 200, 255, 0.8)', // Lighter blue for rocks
    };

    // Setup for drawing
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.font = 'bold 16px Orbitron, Arial';
    ctx.fillStyle = 'rgba(0, 200, 255, 1)';

    // Raycaster to check intersection with the goal
    const raycaster = new THREE.Raycaster();
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    const goalPosition = goalMarker ? goalMarker.position : null;

    // Only process predictions if the goal exists
    if (goalPosition) {
        const goalDirection = new THREE.Vector3()
            .subVectors(goalPosition, cameraPosition)
            .normalize();
        raycaster.set(cameraPosition, goalDirection);
    }

    predictions.forEach((pred) => {
        const { box, score, class: classIndex } = pred;
        const [x1, y1, x2, y2] = box;

        // Scale bounding box to the canvas size
        const scaledX1 = x1 * xScale;
        const scaledY1 = y1 * yScale;
        const scaledX2 = x2 * xScale;
        const scaledY2 = y2 * yScale;

        const width = scaledX2 - scaledX1;
        const height = scaledY2 - scaledY1;

        // Convert bounding box center to world position
        const obstaclePosition = getObstacleWorldPosition(pred, camera, canvasWidth, canvasHeight);

        // Skip rendering if the obstacle is on the ray to the goal
        if (goalPosition && obstaclePosition) {
            const distanceToGoal = raycaster.ray.distanceToPoint(obstaclePosition);
            if (distanceToGoal < 30) {
                // Skip this prediction if it lies on the ray
                return;
            }
        }
        // Set the color based on the class
        const color = classColors[classIndex] || 'rgba(255, 0, 0, 0.8)'; // Default to red for unknown classes
        ctx.strokeStyle = color;
        ctx.fillStyle = color;

        // Draw bounding box
        ctx.strokeRect(scaledX1, scaledY1, width, height);
                // Render label
        const label = classLabels[classIndex] || `Class ${classIndex}`;
        ctx.fillText(
            `${label}, Score: ${score.toFixed(2)}`,
            scaledX1,
            scaledY1 - 5
        );
    });

}

// Adjust the YOLO overlay on window resize
window.addEventListener('resize', adjustYoloOverlay);
adjustYoloOverlay(); // Initial adjustment

// Delay in milliseconds to allow other systems to engage
const setupTime = 2000; // 2 seconds setup time

// Function to start the periodic processCanvas execution
function startProcessing() {
  setInterval(processCanvas, 300); // Start processing every 300ms
}

// Delay the start of the processing
setTimeout(startProcessing, setupTime);

console.log(`Starting processCanvas execution after ${setupTime} ms setup time.`);