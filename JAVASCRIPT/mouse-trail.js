document.addEventListener('mousemove', function(e) {
    // Create a new div element
    const pixel = document.createElement('div');
    pixel.className = 'pixel-trail-element';
    
    // Set its position to the mouse coordinates
    pixel.style.left = e.clientX + 'px';
    pixel.style.top = e.clientY + 'px';

    // Add it to the trail container
    document.getElementById('mouseTrail').appendChild(pixel);

    // Remove the pixel after a short delay to create the trail effect
    setTimeout(() => {
        pixel.remove();
    }, 700); // 700 milliseconds, adjust for a shorter or longer trail
});