$(document).ready(function () {
    const API_BASE_URL = 'http://localhost:3000/';
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    // Check authentication first
    if (!token || !userId) {
        Swal.fire({
            title: 'Login Required',
            text: 'You must be logged in to view this page',
            icon: 'warning',
            confirmButtonText: 'Go to Login'
        }).then(() => {
            window.location.href = '/login.html';
        });
        return;
    }

    // Initialize header
    function initHeader() {
        $('#header').load('/header.html', function (response, status, xhr) {
            if (status === "error") {
                console.error("Failed to load header:", xhr.status, xhr.statusText);
                return;
            }

            // Initialize dropdowns
            const dropdowns = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
            dropdowns.forEach(el => new bootstrap.Dropdown(el));

            // Update UI for logged-in user
            $('#login-link, #register-link').addClass('d-none');
            $('#user-dropdown').removeClass('d-none');

            // Load user profile data for header
            $.ajax({
                url: `${API_BASE_URL}api/users/customers/${userId}`,
                headers: { 'Authorization': `Bearer ${token}` },
                success: function(res) {
                    if (res.success && res.data) {
                        const data = res.data;
                        const fullName = `${data.fname || ''} ${data.lname || ''}`.trim();
                        $('#username').text(fullName || 'USER');
                        if (data.image_path) {
                            $('.profile-img').attr('src', `/${data.image_path}`);
                        }
                    }
                },
                error: function(err) {
                    console.error('Error loading user data:', err);
                }
            });
        });
    }

    // Load profile data
    function fetchProfileData() {
        $.ajax({
            url: `${API_BASE_URL}api/users/customers/${userId}`,
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(res) {
                if (res.success && res.data) {
                    const data = res.data;
                    $('#userId').val(userId);
                    $('#title').val(data.title || '');
                    $('#fname').val(data.fname || '');
                    $('#lname').val(data.lname || '');
                    $('#addressline').val(data.addressline || '');
                    $('#town').val(data.town || '');
                    $('#phone').val(data.phone || '');
                    
                    if (data.image_path) {
                        $('#profileImagePreview').attr('src', `/${data.image_path}`);
                    }
                }
            },
            error: function(err) {
                console.error('Error fetching profile:', err);
                $('#profileMsg').text('Failed to load profile data').css('color', 'red');
            }
        });
    }

    // Handle image preview
    $('#image').on('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#profileImagePreview').attr('src', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Handle form submission
    $('#profileForm').on('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(this);
        formData.append('userId', userId);

        $.ajax({
            url: `${API_BASE_URL}api/users/update-profile`,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            data: formData,
            contentType: false,
            processData: false,
            success: function(res) {
                if (res.success) {
                    Swal.fire({
                        title: 'Success!',
                        text: 'Profile updated successfully',
                        icon: 'success'
                    });
                    fetchProfileData();
                    // Update header image if changed
                    if ($('#image')[0].files[0]) {
                        $('.profile-img').attr('src', $('#profileImagePreview').attr('src'));
                    }
                } else {
                    $('#profileMsg').text(res.message || 'Update failed').css('color', 'red');
                }
            },
            error: function(err) {
                console.error('Update error:', err);
                $('#profileMsg').text('Error updating profile').css('color', 'red');
            }
        });
    });

    // Initialize everything
    initHeader();
    fetchProfileData();
});