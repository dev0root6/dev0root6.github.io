// Get the canvas element and its 2D context
const canvas = document.getElementById("pixelTrail");
const ctx = canvas.getContext("2d");

// Set the canvas dimensions to fill the window
let canvasWidth = window.innerWidth;
let canvasHeight = window.innerHeight;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

// Global mouse object to track position
const mouse = {
    x: undefined,
    y: undefined
};

// Event listener to update mouse position
window.addEventListener('mousemove', (event) => {
    mouse.x = event.x;
    mouse.y = event.y;
});

// Event listener for window resize to adjust canvas size dynamically
window.addEventListener('resize', () => {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
});

// An array to hold all the particles
const particles = [];
const numParticles = 100; // Number of particles

// Particle class to manage each particle's properties and behavior
class Particle {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocity = {
            x: (Math.random() - 0.5) * 0.5, // Slow horizontal movement
            y: (Math.random() - 0.5) * 0.5 // Slow vertical movement
        };
    }

    // Draw the particle as a circle
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.fill();
        ctx.closePath();
    }

    // Update the particle's position and handle wrapping
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // Wrap particles around the screen
        if (this.x < 0) this.x = canvasWidth;
        if (this.x > canvasWidth) this.x = 0;
        if (this.y < 0) this.y = canvasHeight;
        if (this.y > canvasHeight) this.y = 0;
    }
}

// Populate the particles array
function createParticles() {
    for (let i = 0; i < numParticles; i++) {
        const radius = Math.random() * 2 + 1; // Particle size between 1 and 3
        const x = Math.random() * (canvasWidth - radius * 2) + radius;
        const y = Math.random() * (canvasHeight - radius * 2) + radius;
        particles.push(new Particle(x, y, radius));
    }
}

// Function to calculate distance between two points
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Clear the canvas with a slight fade to create a trail effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.84)"; 
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Update and draw each particle
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    // *** Adjusted for Less Density ***
    const maxDistance = 200; // Reduced range for particle-to-particle connections
    const mouseConnectDistance = 150; // Reduced range for particle-to-mouse connections

    // 1. Draw lines between particles that are close
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dist = distance(particles[i], particles[j]);

            if (dist < maxDistance) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                
                // Opacity fades as the distance increases
                ctx.strokeStyle = `rgba(134, 134, 134, ${1 - (dist / maxDistance)})`;
                ctx.stroke();
                ctx.closePath();
            }
        }
    }

    // 2. Draw lines from particles to the mouse cursor
    if (mouse.x !== undefined && mouse.y !== undefined) {
        particles.forEach(p => {
            const distToMouse = distance(p, mouse);

            if (distToMouse < mouseConnectDistance) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
                
                // Cyan color for mouse interaction
                ctx.strokeStyle = `rgba(255, 255, 255, ${1 - (distToMouse / mouseConnectDistance)})`; 
                ctx.stroke();
                ctx.closePath();
            }
        });
    }
}

// Start the animation
createParticles();
animate();
