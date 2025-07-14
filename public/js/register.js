$(document).ready(function () {
    const url = 'http://localhost:3000/'
     $('#registerForm').on('submit', function (e) {
      e.preventDefault();

      const formData = {
        name: $('input[name="name"]').val(),
        email: $('input[name="email"]').val(),
        password: $('input[name="password"]').val()
      };

      $.ajax({
        url: `${url}api/users/register`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(formData),
        success: function (res) {
          $('#message').text(res.message || 'Registration successful ✅').css('color', 'green');

          setTimeout(function () {
            window.location.href = 'login.html';
          }, 1000);
        },

        error: function (err) {
          const msg = err.responseJSON?.error || '❌ Registration failed.';
          $('#message').text(msg).css('color', 'red');
        }
      });
    });
    });
