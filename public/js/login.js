$(document).ready(function () {
    const url = 'http://localhost:3000/';
    $('#loginForm').on('submit', function (e) {
        e.preventDefault();
        const formData = {
            email: $('input[name="email"]').val(),
            password: $('input[name="password"]').val()
        };

        $.ajax({
            url: `${url}api/users/login`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function (res) {
                $('#loginMsg').text('✅ Login successful!').css('color', 'green');
                localStorage.setItem('token', res.token);
                localStorage.setItem('userId', res.user.id);
                
                // Check if profile is complete
                checkProfileCompletion(res.user.id, res.token);
            },
            error: function (err) {
                $('#loginMsg').text('❌ Login failed. Check your credentials.').css('color', 'red');
                console.log(err);
            }
        });
    });

    function checkProfileCompletion(userId, token) {
        $.ajax({
            url: `${url}api/users/customers/${userId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(res) {
                if (res.success && res.data) {
                    const profile = res.data;
                    const isProfileComplete = profile.fname && profile.lname && profile.addressline && profile.town;
                    
                    if (isProfileComplete) {
                        window.location.href = 'home.html';
                    } else {
                        window.location.href = 'profile.html';
                    }
                } else {
                    window.location.href = 'profile.html';
                }
            },
            error: function(err) {
                console.error('Error checking profile:', err);
                window.location.href = 'profile.html';
            }
        });
    }
});