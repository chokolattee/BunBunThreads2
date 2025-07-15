$(document).ready(async function () {
    const API_BASE_URL = 'http://localhost:3000';

    const otable = $('#otable').DataTable({
        ajax: {
            url: `${API_BASE_URL}/api/orders/admin`,
            dataSrc: 'data'
        },
        dom: 'Bfrtip',
        buttons: ['pdf', 'excel'],
        columns: [
            { data: 'orderinfo_id' },
            { data: 'customer_name' },
            {
                data: 'date_placed',
                title: 'Date Placed',
                render: function (data) {
                    return data ? formatDate(data) : 'N/A';
                }
            },
            {
                data: 'date_shipped',
                title: 'Date Shipped',
                render: function (data) {
                    return data ? formatDate(data) : 'Not shipped';
                }
            },
            {
                data: 'date_delivered',
                title: 'Date Delivered',
                render: function (data) {
                    return data ? formatDate(data) : 'Not delivered';
                }
            },
            {
                data: 'shipping_method',
                title: 'Shipping Method',
                render: function (data) {
                    return data || 'N/A';
                }
            },
            {
                data: 'status',
                title: 'Status',
                render: function (data) {
                    let badgeClass = 'badge-secondary';
                    if (data === 'Shipped') badgeClass = 'badge-primary';
                    if (data === 'Delivered') badgeClass = 'badge-success';
                    if (data === 'Cancelled') badgeClass = 'badge-danger';
                    if (data === 'Pending') badgeClass = 'badge-warning';
                    return `<span class="badge ${badgeClass}">${data}</span>`;
                }
            },
            {
                data: null,
                title: 'Actions',
                render: function (data, type, row) {
                    const isDeleted = !!row.deleted_at;
                    return `
        <div class="btn-group" role="group">
            <button class="btn btn-sm btn-primary view-order" data-id="${row.orderinfo_id}">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-sm btn-warning edit-order" data-id="${row.orderinfo_id}">
                <i class="fas fa-edit"></i> Edit
            </button>
           ${isDeleted
                            ? `<button class="btn btn-sm btn-success restore-order" data-id="${row.orderinfo_id}">
       <i class="fas fa-undo"></i> Restore
     </button>`
                            : `<button class="btn btn-sm btn-danger delete-order" data-id="${row.orderinfo_id}">
       <i class="fas fa-trash"></i> Delete
     </button>`
                        }
        </div>
    `;
                }
            }
        ],
        initComplete: function () {
            console.log('DataTable initialized');
        }
    });

    // Helper function to format dates
    function formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
        }
    }

    // Helper function to get status badge
    function getStatusBadge(status) {
        let badgeClass = 'badge-secondary';
        if (status === 'Shipped') badgeClass = 'badge-primary';
        if (status === 'Delivered') badgeClass = 'badge-success';
        if (status === 'Cancelled') badgeClass = 'badge-danger';
        if (status === 'Pending') badgeClass = 'badge-warning';

        return `<span class="badge ${badgeClass}">${status || 'Unknown'}</span>`;
    }

    // Function to show order details in a modal
    function showOrderDetailsModal(orderData) {
        // Create the modal HTML if it doesn't exist
        if ($('#orderDetailsModal').length === 0) {
            const modalHTML = `
                <div class="modal fade" id="orderDetailsModal" tabindex="-1" role="dialog" aria-labelledby="orderDetailsModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-lg" role="document">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="orderDetailsModalLabel">Order Details</h5>
                                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>Order Information</h6>
                                        <table class="table table-sm">
                                            <tr>
                                                <td><strong>Order ID:</strong></td>
                                                <td id="modal-order-id"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Customer:</strong></td>
                                                <td id="modal-customer-name"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Status:</strong></td>
                                                <td id="modal-status"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Date Placed:</strong></td>
                                                <td id="modal-date-placed"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Date Shipped:</strong></td>
                                                <td id="modal-date-shipped"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Date Delivered:</strong></td>
                                                <td id="modal-date-delivered"></td>
                                            </tr>
                                        </table>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Shipping Information</h6>
                                        <table class="table table-sm">
                                            <tr>
                                                <td><strong>Shipping Method:</strong></td>
                                                <td id="modal-shipping-method"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Shipping Rate:</strong></td>
                                                <td id="modal-shipping-rate"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Subtotal:</strong></td>
                                                <td id="modal-subtotal"></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Total:</strong></td>
                                                <td id="modal-total"></td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                                
                                <hr>
                                
                                <h6>Order Items</h6>
                                <div class="table-responsive">
                                    <table class="table table-striped" id="modal-items-table">
                                        <thead>
                                            <tr>
                                                <th>Item Name</th>
                                                <th>Quantity</th>
                                                <th>Unit Price</th>
                                                <th>Total Price</th>
                                            </tr>
                                        </thead>
                                        <tbody id="modal-items-tbody">
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Append modal to body
            $('body').append(modalHTML);
        }

        // Populate modal with order data
        populateOrderDetailsModal(orderData);

        // Show the modal
        $('#orderDetailsModal').modal('show');
    }

    function populateOrderDetailsModal(orderData) {
        // Basic order information
        $('#modal-order-id').text(orderData.orderinfo_id || 'N/A');
        $('#modal-customer-name').text(orderData.customer_name || 'N/A');

        // Status with badge
        const statusBadge = getStatusBadge(orderData.status);
        $('#modal-status').html(statusBadge);

        // Dates
        $('#modal-date-placed').text(orderData.date_placed ? formatDate(orderData.date_placed) : 'N/A');
        $('#modal-date-shipped').text(orderData.date_shipped ? formatDate(orderData.date_shipped) : 'Not shipped');
        $('#modal-date-delivered').text(orderData.date_delivered ? formatDate(orderData.date_delivered) : 'Not delivered');

        // Calculate totals
        const subtotal = parseFloat(orderData.subtotal || 0);
        const shippingRate = parseFloat(orderData.shipping_rate || 0);
        const total = subtotal + shippingRate;

        // Shipping information
        $('#modal-shipping-method').text(orderData.shipping_method || 'N/A');
        $('#modal-shipping-rate').text(`₱${shippingRate.toFixed(2)}`);
        $('#modal-subtotal').text(`₱${subtotal.toFixed(2)}`);
        $('#modal-total').text(`₱${total.toFixed(2)}`);

        // Clear previous items
        $('#modal-items-tbody').empty();

        // Populate items
        if (orderData.items && orderData.items.length > 0) {
            orderData.items.forEach(item => {
                const row = `
                <tr>
                    <td>${item.item_name || 'N/A'}</td>
                    <td>${item.quantity || 0}</td>
                    <td>₱${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                    <td>₱${parseFloat(item.total_price || 0).toFixed(2)}</td>
                </tr>
            `;
                $('#modal-items-tbody').append(row);
            });
        } else {
            $('#modal-items-tbody').append('<tr><td colspan="4" class="text-center">No items found</td></tr>');
        }
    }

    // Search functionality
    $('#searchButton').click(function () {
        otable.search($('#orderSearch').val()).draw();
    });

    $('#orderSearch').keyup(function (e) {
        if (e.keyCode === 13) {
            otable.search($(this).val()).draw();
        }
    });

    // View order details
    $(document).on('click', '.view-order', async function () {
        const orderId = $(this).data('id');

        // Add debugging
        console.log('View order clicked, ID:', orderId);

        if (!orderId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Order ID not found'
            });
            return;
        }

        try {
            // Show loading state
            Swal.fire({
                title: 'Loading...',
                text: 'Fetching order details',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Ensure orderId is properly encoded
            const encodedOrderId = encodeURIComponent(orderId);
            console.log('Fetching from URL:', `${API_BASE_URL}/api/orders/admin/${encodedOrderId}`);

            const response = await fetch(`${API_BASE_URL}/api/orders/admin/${encodedOrderId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            const responseData = await response.json();
            console.log('Response data:', responseData);

            Swal.close(); // Close loading dialog

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${responseData.message || 'Failed to fetch order details'}`);
            }

            if (!responseData.success) {
                throw new Error(responseData.message || 'Failed to fetch order details');
            }

            // Show order details in a modal
            showOrderDetailsModal(responseData.data);
        } catch (error) {
            Swal.close(); // Make sure loading dialog is closed
            console.error('Error viewing order:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to load order details'
            });
        }
    });

    // Edit order status
    $(document).on('click', '.edit-order', async function () {
        const orderId = $(this).data('id');
        console.log('Edit order clicked, ID:', orderId);

        if (!orderId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Order ID not found'
            });
            return;
        }

        try {
            Swal.fire({
                title: 'Loading...',
                text: 'Fetching order details',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const encodedOrderId = encodeURIComponent(orderId);
            const response = await fetch(`${API_BASE_URL}/api/orders/admin/${encodedOrderId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const responseData = await response.json();
            Swal.close();

            if (!response.ok || !responseData.success) {
                throw new Error(responseData.message || 'Failed to fetch order details');
            }

            const currentStatus = responseData.data.status;

            // Restrict editing for Delivered or Cancelled
            if (currentStatus === 'Delivered' || currentStatus === 'Cancelled') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Not Allowed',
                    text: `You cannot edit an order that is ${currentStatus}.`
                });
                return;
            }

            $('#editOrderModal #status').val(currentStatus);
            $('#updateStatusButton').data('id', orderId);
            $('#updateStatusButton').data('current-status', currentStatus); // Save current status for validation

            $('#editOrderModal').modal('show');
        } catch (error) {
            Swal.close();
            console.error('Error editing order:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to load order details'
            });
        }
    });

    // Update order status
    $('#updateStatusButton').click(async function () {
        const orderId = $(this).data('id');
        const currentStatus = $(this).data('current-status');
        const newStatus = $('#editOrderModal #status').val();

        console.log('Update status clicked, ID:', orderId, 'New Status:', newStatus, 'Current Status:', currentStatus);

        if (!orderId || !newStatus) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Order ID and new status are required'
            });
            return;
        }

        // Prevent changing to 'Cancelled' if current status is 'Shipped'
        if (currentStatus === 'Shipped' && newStatus === 'Cancelled') {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Action',
                text: 'You cannot cancel an order that has already been shipped.'
            });
            return;
        }

        try {
            Swal.fire({
                title: 'Updating...',
                text: 'Updating order status',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const encodedOrderId = encodeURIComponent(orderId);
            const response = await fetch(`${API_BASE_URL}/api/orders/admin/${encodedOrderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            const responseData = await response.json();
            Swal.close();

            if (!response.ok || !responseData.success) {
                throw new Error(responseData.message || 'Failed to update order status');
            }

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Order status updated successfully'
            });

            $('#editOrderModal').modal('hide');
            otable.ajax.reload();
        } catch (error) {
            console.error('Error updating order status:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Failed to update order status'
            });
        }
    });

    $(document).on('click', '.delete-order', function () {
        const orderId = $(this).data('id');

        Swal.fire({
            title: 'Delete Order?',
            text: 'This will mark the order as deleted (soft delete).',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        }).then(function (result) {
            if (!result.isConfirmed) return;

            fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        if (!response.ok || !data.success) {
                            throw new Error(data.message || 'Failed to delete order.');
                        }

                        Swal.fire('Deleted!', 'The order has been marked as deleted.', 'success');
                        $('#otable').DataTable().ajax.reload();
                    });
                })
                .catch(function (err) {
                    Swal.fire('Error', err.message || 'Something went wrong.', 'error');
                });
        });
    });


    $(document).on('click', '.restore-order', function () {
        const orderId = $(this).data('id');

        Swal.fire({
            title: 'Restore Order?',
            text: 'This will restore the previously deleted order.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, restore it!',
            cancelButtonText: 'Cancel'
        }).then(function (result) {
            if (!result.isConfirmed) return;

            fetch(`${API_BASE_URL}/api/orders/admin/${orderId}/restore`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        if (!response.ok || !data.success) {
                            throw new Error(data.message || 'Failed to restore order.');
                        }

                        Swal.fire('Restored!', 'The order has been restored successfully.', 'success');
                        $('#otable').DataTable().ajax.reload();
                    });
                })
                .catch(function (err) {
                    Swal.fire('Error', err.message || 'Something went wrong.', 'error');
                });
        });
    });




    window.showOrderDetailsModal = showOrderDetailsModal;
    window.formatDate = formatDate;
    window.getStatusBadge = getStatusBadge;
});