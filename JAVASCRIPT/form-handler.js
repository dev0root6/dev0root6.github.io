const form = document.querySelector('form[name="contact-form"]');
const scriptURL = 'https://script.google.com/macros/s/AKfycbwMhbos8HuZq5kDgn8OzqMTKSd8U9yKmIyRx78CQmW9plbvFgDl1Wmh_rmEtBX3Blwl/exec';

form.addEventListener('submit', e => {
    e.preventDefault();
    
    const submitBtn = form.querySelector('.btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const formData = new FormData(form);

    fetch(scriptURL, { method: 'POST', body: formData })
        .then(response => {
            if (response.ok) {
                alert('Message sent successfully!');
                form.reset();
            } else {
                alert('An error occurred. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error!', error.message);
            alert('An error occurred. Please try again.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Message';
        });
});