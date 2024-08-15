document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (response.redirected) {
                window.location.href = response.url;
            } else {
                const result = await response.text();
                alert(result);
            }
        } catch (error) {
            console.error('Error en el inicio de sesión:', error);
            alert('Error en el servidor');
        }
    });
});
