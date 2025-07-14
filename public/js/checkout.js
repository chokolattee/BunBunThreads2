$(document).ready(function () {
    const API_BASE_URL = 'http://localhost:3000';
    
    let shippingRates = [];
    let checkoutCart = [];
    let itemsTotal = 0;
    
    checkoutCart = JSON.parse(localStorage.getItem('checkoutCart')) || [];
    
    if (checkoutCart.length === 0) {
        $('#cartSummary').html('<p class="text-muted">No items in checkout.</p>');
        return;
    }
    
    itemsTotal = checkoutCart.reduce((sum, item) => sum + item.quantity * item.price, 0);
    $('#itemsTotal').text(itemsTotal.toFixed(2));
    $('#grandTotal').text(itemsTotal.toFixed(2));
    
    // 🎨 Display items as cards
    let cartHtml = '';
    checkoutCart.forEach(item => {
        const subtotal = item.price * item.quantity;
        cartHtml += `
            <div class="checkout-card">
                <img src="/uploads/${item.image_path}" alt="${item.name}" onerror="this.src='/images/no-image.png'">
                <div class="checkout-details">
                    <h6>${item.name}</h6>
                    <small>Price: ₱${parseFloat(item.price).toFixed(2)}</small><br>
                    <small>Quantity: ${item.quantity}</small><br>
                    <strong>Subtotal: ₱${subtotal.toFixed(2)}</strong>
                </div>
            </div>`;
    });
    $('#cartSummary').html(cartHtml);
    
    // Load shipping regions
    $.get(`${API_BASE_URL}/api/orders/shipping`, function (res) {
        if (res.success && Array.isArray(res.data)) {
            shippingRates = res.data;
            res.data.forEach(region => {
                $('#shippingRegion').append(`
                    <option value="${region.shipping_id}" data-rate="${region.rate}">
                        ${region.region} (₱${parseFloat(region.rate).toFixed(2)})
                    </option>
                `);
            });
        }
    }).fail(function(xhr, status, error) {
        console.error('Failed to load shipping regions:', error);
        alert('Failed to load shipping options. Please try again.');
    });
    
    
    // Recalculate grand total when region changes
    $('#shippingRegion').on('change', function () {
        const selectedRate = parseFloat($(this).find(':selected').data('rate')) || 0;
        $('#shippingRate').text(selectedRate.toFixed(2));
        const newTotal = itemsTotal + selectedRate;
        $('#grandTotal').text(newTotal.toFixed(2));
    });
    
    // Place order
    $('#checkoutForm').on('submit', function (e) {
        e.preventDefault();
        
        const shipping_id = $('#shippingRegion').val();
        if (!shipping_id) {
            alert("Please select a shipping region.");
            return;
        }
        
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        
        if (!token || !userId) {
            alert("Please log in to place an order.");
            window.location.href = '/login.html';
            return;
        }
        
        const datePlaced = new Date().toISOString().split('T')[0];
        
        // Show loading state
        const submitBtn = $(this).find('button[type="submit"]');
        const originalText = submitBtn.text();
        submitBtn.prop('disabled', true).text('Processing...');
        
        // Get actual userId
        $.get(`${API_BASE_URL}/api/users/customers/${userId}`, function (res) {
            if (!res.success || !res.data || !res.data.customer_id) {
                alert("❌ Cannot place order. Please complete your profile first.");
                submitBtn.prop('disabled', false).text(originalText);
                return;
            }
            
            const orderPayload = {
                customer_id: res.data.customer_id,
                date_placed: datePlaced,
                shipping_id,
                status: 'Pending',
                items: checkoutCart
            };
            
            $.ajax({
                url: `${API_BASE_URL}/api/orders`,
                method: 'POST',
                contentType: 'application/json',
                headers: { Authorization: `Bearer ${token}` },
                data: JSON.stringify(orderPayload),
                success: function (res) {
                    if (res.success) {
                        alert('✅ Order placed successfully!');
                        
                        let cart = JSON.parse(localStorage.getItem('cart')) || [];
                        
                        const updatedCart = cart.filter(cartItem => {
                            return !checkoutCart.some(checkedOut => checkedOut.id === cartItem.id);
                        });
                        
                        localStorage.setItem('cart', JSON.stringify(updatedCart));
                        localStorage.removeItem('checkoutCart'); 
                        
                        window.location.href = '/myorders.html';
                    } else {
                        alert('❌ Failed to place order: ' + (res.message || 'Unknown error'));
                        submitBtn.prop('disabled', false).text(originalText);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Order placement failed:', error);
                    alert('❌ Failed to place order. Please try again.');
                    submitBtn.prop('disabled', false).text(originalText);
                }
            });
        }).fail(function(xhr, status, error) {
            console.error('Failed to get customer info:', error);
            alert('❌ Failed to verify customer information. Please try again.');
            submitBtn.prop('disabled', false).text(originalText);
        });
    });
});