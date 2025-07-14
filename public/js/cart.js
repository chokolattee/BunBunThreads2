 $(document).ready(function () {
        // Configuration
        const API_BASE_URL = 'http://localhost:3000';
        const CART_KEY = 'cart';
        const CHECKOUT_CART_KEY = 'checkoutCart';

        // DOM Elements
        const $cartContents = $('#cartContents');
        const $cartCount = $('#cart-count');
        const $selectedTotal = $('#selectedTotal');
        const $selectedCount = $('#selectedCount');
        const $checkoutBtn = $('#checkoutBtn');

        // Utility Functions
        function formatPrice(price) {
            return `₱${parseFloat(price).toFixed(2)}`;
        }

        function getCart() {
            return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        }

        function saveCart(cart) {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
        }

        // Cart Functions
        function updateCartCount() {
            const cart = getCart();
            const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
            $cartCount.text(totalQty);
        }

        function renderEmptyCart() {
            $cartContents.html(`
                <div class="empty-cart">
                    <i class="bi bi-cart-x"></i>
                    <h3>Your cart is empty</h3>
                    <p>Looks like you haven't added anything to your cart yet.</p>
                    <a href="/shop.html" class="btn btn-primary">Start Shopping</a>
                </div>
            `);
            $selectedTotal.text('TOTAL: ₱0.00');
            $selectedCount.text('0');
            $checkoutBtn.prop('disabled', true);
        }

        function renderCart() {
            const cart = getCart();

            if (cart.length === 0) {
                renderEmptyCart();
                return;
            }

            let html = `
                <div class="card">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-dark">
                                    <tr>
                                        <th class="text-center">
                                            <input type="checkbox" class="form-check-input" id="selectAll" checked>
                                        </th>
                                        <th>Product</th>
                                        <th class="text-center">Price</th>
                                        <th class="text-center">Quantity</th>
                                        <th class="text-center">Subtotal</th>
                                        <th class="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            cart.forEach((item, index) => {
                const quantity = item.quantity || 1;
                const subtotal = parseFloat(item.price) * quantity;

                html += `
                    <tr data-index="${index}">
                        <td class="text-center">
                            <input type="checkbox" class="form-check-input item-check" data-index="${index}" checked>
                        </td>
                        <td>
                            <div class="d-flex align-items-center">
                                <img src="/uploads/${item.image_path || 'default.jpg'}" 
                                     alt="${item.name}" 
                                     class="cart-item-image me-3 rounded"
                                     onerror="this.src='/uploads/default.jpg'">
                                <div>
                                    <h6 class="mb-0">${item.name}</h6>
                                    <small class="text-muted">${item.description || ''}</small>
                                </div>
                            </div>
                        </td>
                        <td class="text-center">
                            <strong>${formatPrice(item.price)}</strong>
                        </td>
                        <td class="text-center">
                            <div class="input-group" style="width: 120px; margin: 0 auto;">
                                <button class="btn btn-outline-secondary btn-sm qty-btn" data-action="decrease" data-index="${index}">-</button>
                                <input type="number" 
                                       class="form-control form-control-sm text-center quantity-input" 
                                       data-index="${index}" 
                                       value="${quantity}" 
                                       min="1" 
                                       readonly>
                                <button class="btn btn-outline-secondary btn-sm qty-btn" data-action="increase" data-index="${index}">+</button>
                            </div>
                        </td>
                        <td class="text-center">
                            <strong class="item-subtotal">${formatPrice(subtotal)}</strong>
                        </td>
                        <td class="text-center">
                            <button class="btn btn-danger btn-sm remove-btn" data-index="${index}" title="Remove item">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>`;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;

            $cartContents.html(html);
            $checkoutBtn.prop('disabled', false);
            updateCartCount();
            recalculateSelectedTotal();
        }

        function recalculateSelectedTotal() {
            const cart = getCart();
            let total = 0;
            let selectedCount = 0;

            $('.item-check:checked').each(function () {
                const index = $(this).data('index');
                const quantity = parseInt($(`.quantity-input[data-index="${index}"]`).val()) || 1;
                const price = parseFloat(cart[index].price);
                total += price * quantity;
                selectedCount++;
            });

            $selectedTotal.text(`TOTAL: ${formatPrice(total)}`);
            $selectedCount.text(selectedCount);
            $checkoutBtn.prop('disabled', selectedCount === 0);
        }

        function updateCartItem(index, quantity) {
            const cart = getCart();
            if (cart[index]) {
                cart[index].quantity = quantity;
                saveCart(cart);
                updateCartCount();
                
                // Update subtotal display
                const price = parseFloat(cart[index].price);
                const subtotal = price * quantity;
                $(`.quantity-input[data-index="${index}"]`).val(quantity);
                $(`tr[data-index="${index}"] .item-subtotal`).text(formatPrice(subtotal));
                
                recalculateSelectedTotal();
            }
        }

        function removeCartItem(index) {
            const cart = getCart();
            if (cart[index]) {
                cart.splice(index, 1);
                saveCart(cart);
                renderCart();
            }
        }

        function prepareCheckout() {
            const cart = getCart();
            const selectedItems = [];

            $('.item-check:checked').each(function () {
                const index = $(this).data('index');
                if (cart[index]) {
                    selectedItems.push(cart[index]);
                }
            });

            if (selectedItems.length === 0) {
                alert('Please select at least one item to checkout.');
                return false;
            }

            localStorage.setItem(CHECKOUT_CART_KEY, JSON.stringify(selectedItems));
            return true;
        }

        // Event Handlers
        $(document).on('click', '.qty-btn', function() {
            const action = $(this).data('action');
            const index = $(this).data('index');
            const $input = $(`.quantity-input[data-index="${index}"]`);
            let currentQty = parseInt($input.val()) || 1;
            
            if (action === 'increase') {
                currentQty++;
            } else if (action === 'decrease' && currentQty > 1) {
                currentQty--;
            }
            
            updateCartItem(index, currentQty);
        });

        $(document).on('change', '.quantity-input', function() {
            const index = $(this).data('index');
            let newQty = parseInt($(this).val()) || 1;
            newQty = Math.max(1, newQty);
            updateCartItem(index, newQty);
        });

        $(document).on('click', '.remove-btn', function() {
            if (confirm('Are you sure you want to remove this item from your cart?')) {
                removeCartItem($(this).data('index'));
            }
        });

        $(document).on('click', '#checkoutBtn', function() {
            if (prepareCheckout()) {
                window.location.href = '/checkout.html';
            }
        });

        $(document).on('change', '.item-check', function() {
            recalculateSelectedTotal();
        });

        $(document).on('change', '#selectAll', function() {
            const isChecked = $(this).is(':checked');
            $('.item-check').prop('checked', isChecked);
            recalculateSelectedTotal();
        });

        // Initialize the page
        function init() {
            $('#header').load('/header.html', function () {
                const dropdowns = [].slice.call(document.querySelectorAll('[data-bs-toggle="dropdown"]'));
                dropdowns.forEach(el => new bootstrap.Dropdown(el));

                const token = localStorage.getItem('token');
                const userId = localStorage.getItem('userId');

                if (token && userId) {
                    $('#login-link, #register-link').addClass('d-none');
                    $('#user-dropdown').removeClass('d-none');

                    $.get(`${API_BASE_URL}api/users/customers/${userId}`)
                        .done(function (res) {
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
            });
            renderCart();
        }

        // Logout function
        window.logout = function() {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            window.location.href = '/login.html';
        };

        // Initialize the page
        init();
    });