// ---------------------------------------------------------------- //
// heightmap-noise.js
// Generate a 3D moon scene of navigable terrain
// 1. Generates a noise function for soft slopes
// 2. Generates lighting surface normals and locations for potholes
//      TODO:
//    - Right now potholes are just perfect cones
//    - Surface normals only reflect a single light source I think
//    - Positioning the light sources would be helpful probably
// 3. Probably want a Player Camera mode
// ---------------------------------------------------------------- //

import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
const texture = new THREE.TextureLoader().load('../textures/regolith1.jpg'); // Replace with your texture path
const material = new THREE.MeshStandardMaterial({ map: texture, wireframe: false });
const plane = new THREE.Mesh(geometry, material);
plane.receiveShadow = true; // Make sure the plane can receive shadows
plane.rotation.x = -Math.PI / 2; // Rotate the plane to make it horizontal
scene.add(plane);

// Create a canvas for noise display
const noiseCanvas = document.getElementById('noiseCanvas');
const noiseCtx = noiseCanvas.getContext('2d');

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

        // Create a dodecahedron geometry for a more rock-like shape
        const rockGeometry = new THREE.DodecahedronGeometry(rockSize / 2, 0); // Low-poly dodecahedron shape

        // Apply Perlin noise for cohesive distortion
        const positionAttribute = rockGeometry.attributes.position;
        for (let j = 0; j < positionAttribute.count; j++) {
            const x = positionAttribute.getX(j);
            const y = positionAttribute.getY(j);
            const z = positionAttribute.getZ(j);

            // Use Perlin noise based on vertex position to distort cohesively
            const noiseValue = noise.noise3D(x * 0.1, y * 0.1, z * 0.1); // Adjust scale as needed
            const displacement = noiseValue * rockSize * 0.1; // Control the amount of displacement

            // Apply the displacement proportionally along the vertex's direction
            positionAttribute.setX(j, x + x * displacement);
            positionAttribute.setY(j, y + y * displacement);
            positionAttribute.setZ(j, z + z * displacement);
        }
        rockGeometry.computeVertexNormals(); // Recompute normals after distortion

// Set a light gray color with slight random variation
const grayBase = 0xD3D3D3; // Base color for light gray (hexadecimal for RGB 211, 211, 211)
const variation = Math.random() * 0.1 - 0.05; // Small variation factor

// Adjust color slightly for each rock to create natural variation
const rockColor = new THREE.Color(grayBase).offsetHSL(0, 0, variation);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: rockColor, 
            roughness: 0.9 + Math.random() * 0.1,
            metalness: 0.1
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.castShadow = true; // Enable shadow casting for rocks

        // Randomly position each rock on the terrain
        const rockX = Math.random() * width - width / 2;
        const rockZ = Math.random() * height - height / 2;

        // Calculate height at the rock position from the heightmap
        const heightX = Math.floor((rockX + width / 2) / width * geometry.parameters.widthSegments);
        const heightZ = Math.floor((rockZ + height / 2) / height * geometry.parameters.heightSegments);
        const heightIndex = heightX * width + heightZ;
        const terrainHeight = lastHeightmapData ? lastHeightmapData[heightIndex] : 0;

        // Position the rock at the calculated height
        rock.position.set(rockX, terrainHeight + rockSize / 2, rockZ);

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
document.getElementById('generateNoiseBtn').addEventListener('click', visualizeNoise);

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

// Modify the animate function to update the camera
function animate() {
    requestAnimationFrame(animate);
    updateCamera(); // Call the camera update function
    // controls.update(); // Update the controls
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

    for (let i = 0; i < numSlices; i++) {
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
    }
}

// Main script
const worker = new Worker('processCanvasWorker.js');

// Handle message from the worker
worker.onmessage = function (event) {
    const { drivabilityScores } = event.data;
    updateGuidelines(drivabilityScores); // Update guidelines with the processed scores
};

function processCanvas() {
    const gl = renderer.getContext();
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    const pixels = new Uint8Array(width * height * 4);

    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Send pixel data to worker
    worker.postMessage({ pixels, width, height });
}

// Call processCanvas periodically or on demand
setInterval(processCanvas, 1000); // Or integrate with your animate pipeline

// Ensure OpenCV.js is ready before running
function openCvReady() {
    cv['onRuntimeInitialized'] = () => {
        cv.FS_createPath("/", "working", true, true);
        setInterval(processCanvas, 1000); // Run processing every 500 ms
    };
}
openCvReady();