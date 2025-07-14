$(document).ready(function () {
    const url = 'http://localhost:3000/'

    function updateCartCount() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        $('#cart-count').text(cart.length);
    }

    $(document).ready(function () {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');

        if (token && userId) {
            $('#login-link, #register-link').addClass('d-none');
            $('#user-dropdown').removeClass('d-none');

            $.get(`${url}api/users/customers/${userId}`, function (res) {
                if (res.success && res.data) {
                    const data = res.data;
                    const fullName = `${data.fname || ''} ${data.lname || ''}`.trim();
                    $('#username').text(fullName || 'USER');
                    if (data.image_path) {
                        $('.profile-img').attr('src', `/${data.image_path}`);
                    }
                }
            });
        } else {
            $('#login-link, #register-link').removeClass('d-none');
            $('#user-dropdown').addClass('d-none');
        }

        window.logoutUser = function () {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('cart'); 
            window.location.href = '/login.html';
        };
        updateCartCount();
    });
});
