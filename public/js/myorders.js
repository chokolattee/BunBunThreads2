$(document).ready(async function () {
    const API_BASE_URL = 'http://localhost:3000';
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    // Check authentication
    if (!token || !userId) {
        alert('⛔ Please log in first.');
        window.location.href = '/login.html';
        return;
    }

    // Load header with loading indicator
    $('#header').html(`
        <div class="d-flex justify-content-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `);

    try {
        await loadHeader();
        await loadOrders();
        
    } catch (error) {
        console.error('Initialization error:', error);
        alert('⚠️ Failed to load page content. Please try again.');
    }

    // Header loading function
    async function loadHeader() {
        return new Promise((resolve) => {
            $('#header').load('/header.html', function () {
                // Initialize dropdowns
                const dropdownTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
                dropdownTriggerList.forEach(dropdownTriggerEl => {
                    new bootstrap.Dropdown(dropdownTriggerEl);
                });

                if (token && userId) {
                    $('#login-link, #register-link').addClass('d-none');
                    $('#user-dropdown').removeClass('d-none');

                    $.get(`${API_BASE_URL}/api/users/customers/${userId}`, function (res) {
                        if (res.success && res.data) {
                            const data = res.data;
                            const fullName = `${data.fname || ''} ${data.lname || ''}`.trim();
                            $('#username').text(fullName || 'USER');
                            if (data.image_path) {
                                $('.profile-img').attr('src', `/${data.image_path}`);
                            }
                        }
                    });
                }
                updateCartCount();
                resolve();
            });
        });
    }

    async function loadOrders() {
        try {
            console.log('Loading orders for userId:', userId);
            
            // Show loading state
            $('#ordersList').html(`
                <div class="d-flex justify-content-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading orders...</span>
                    </div>
                </div>
            `);

            // Get customer profile with proper error handling
            const profileRes = await $.ajax({
                url: `${API_BASE_URL}/api/users/customers/${userId}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Profile response:', profileRes);
            
            if (!profileRes.success || !profileRes.data) {
                $('#ordersList').html('<p class="text-danger">⚠️ No customer profile found.</p>');
                return;
            }

            const customerId = profileRes.data.customer_id;
            console.log('Customer ID:', customerId);
            
            if (!customerId) {
                $('#ordersList').html('<p class="text-danger">⚠️ Customer ID not found in profile.</p>');
                return;
            }

            // Get orders
            const ordersRes = await $.ajax({
                url: `${API_BASE_URL}/api/orders/customer/${customerId}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('Orders response:', ordersRes);
            
            if (!ordersRes.success) {
                $('#ordersList').html(`<p class="text-danger">⚠️ Failed to load orders: ${ordersRes.message || 'Unknown error'}</p>`);
                return;
            }

            if (!Array.isArray(ordersRes.data) || ordersRes.data.length === 0) {
                $('#ordersList').html(`
                    <div class="text-center py-5">
                        <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                        <h4 class="text-muted">No Orders Yet</h4>
                        <p class="text-muted">You haven't placed any orders yet.</p>
                        <a href="/shop.html" class="btn btn-primary">Start Shopping</a>
                    </div>
                `);
                return;
            }

            // Process and display orders
            const html = ordersRes.data.map(order => {
                // Handle missing or invalid items array
                const items = Array.isArray(order.items) ? order.items : [];
                
                // Calculate total
                const total = items.reduce((sum, item) => {
                    const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
                    return sum + itemTotal;
                }, 0);

                // Add shipping cost if available
                const shippingCost = parseFloat(order.rate) || 0;
                const grandTotal = total + shippingCost;

                return `
                    <div class="order-card mb-4 p-3 border rounded shadow-sm">
                        <div class="order-header d-flex justify-content-between align-items-center mb-2">
                            <div><strong>Order #${order.orderinfo_id}</strong></div>
                            <div><span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span></div>
                        </div>
                        <div class="row mb-2">
                            <div class="col-md-6">
                                <small class="text-muted">Date Placed:</small><br>
                                <strong>${formatDate(order.date_placed)}</strong>
                            </div>
                            <div class="col-md-6">
                                <small class="text-muted">Shipping:</small><br>
                                <strong>${order.region || 'N/A'} - ₱${shippingCost.toFixed(2)}</strong>
                            </div>
                        </div>
                        
                        ${items.length > 0 ? `
                            <div class="order-items">
                                <strong>Items:</strong>
                                <div class="mt-2">
                                    ${items.map(item => `
                                        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                                            <div>
                                                <span class="fw-medium">${item.item_name || 'Unknown Item'}</span>
                                                <small class="text-muted d-block">Qty: ${item.quantity || 0}</small>
                                            </div>
                                            <span class="fw-bold">₱${((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toFixed(2)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : '<p class="text-muted">No items found for this order.</p>'}
                        
                        <div class="mt-3 pt-2 border-top">
                            <div class="row">
                                <div class="col-md-6">
                                    <small class="text-muted">Items Total: ₱${total.toFixed(2)}</small><br>
                                    <small class="text-muted">Shipping: ₱${shippingCost.toFixed(2)}</small>
                                </div>
                                <div class="col-md-6 text-end">
                                    <strong class="fs-5">Grand Total: ₱${grandTotal.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            $('#ordersList').html(html);
            
        } catch (error) {
            console.error('Error loading orders:', error);
            
            let errorMessage = 'Failed to load orders. Please try again.';
            
            if (error.status === 401) {
                errorMessage = 'Authentication failed. Please log in again.';
                setTimeout(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    window.location.href = '/login.html';
                }, 2000);
            } else if (error.status === 403) {
                errorMessage = 'Access denied. You don\'t have permission to view these orders.';
            } else if (error.status === 404) {
                errorMessage = 'Orders not found or API endpoint not available.';
            } else if (error.status === 500) {
                errorMessage = 'Server error. Please try again later.';
            }
            
            $('#ordersList').html(`<p class="text-danger">⚠️ ${errorMessage}</p>`);
        }
    }

    // Helper functions
    function updateCartCount() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        $('#cart-count').text(totalQty);
    }

    function formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return 'Invalid Date';
        }
    }

    function getStatusBadgeClass(status) {
        const statusClasses = {
            'Pending': 'bg-warning text-dark',
            'Processing': 'bg-primary',
            'Shipped': 'bg-info',
            'Delivered': 'bg-success',
            'Cancelled': 'bg-danger'
        };
        return statusClasses[status] || 'bg-secondary';
    }
});

window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = '/login.html';
};