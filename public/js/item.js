$(document).ready(function () {
      const baseUrl = 'http://localhost:3000/api/item/admin'; // New endpoint to show all
      const categoryUrl = 'http://localhost:3000/api/category';
      const imageBaseUrl = 'http://localhost:3000/images/'; // Fixed: Removed 'public/' since it's served statically

      $.get(categoryUrl, function (res) {
        if (res.success) {
          res.data.forEach(cat => {
            $('#category').append(`<option value="${cat.category_id}">${cat.description}</option>`);
          });
        }
      });

      const table = $('#itable').DataTable({
        ajax: {
          url: baseUrl,
          dataSrc: 'data'
        },
        dom: 'Bfrtip',
        buttons: ['pdf', 'excel'],
        columns: [
          { data: 'item_id' },
          { data: 'item_name' },
          {
            data: 'all_images',
            render: function (images) {
              if (!images || images.length === 0) return 'No Image';
              const unique = [...new Set(images)]; // prevent duplicate images
              return unique.map(img => `<img src="${imageBaseUrl}${img}" width="40" height="40" class="mr-1 mb-1" onerror="this.src='${imageBaseUrl}placeholder.jpg'; this.onerror=null;"/>`).join('');
            }
          },
          { data: 'description' },
          { data: 'cost_price' },
          { data: 'sell_price' },
          { data: 'quantity' },
          { data: 'category_name' },
          {
            data: null,
            render: function (data) {
              if (data.deleted_at) {
                return `
                  <a href="#" class="restoreBtn ml-2" data-id="${data.item_id}">
                    <i class="fas fa-undo text-success" style="font-size: 20px;"></i>
                  </a>`;
              } else {
                return `
                  <a href="#" class="editBtn" data-id="${data.item_id}">
                    <i class="fas fa-edit text-primary" style="font-size: 20px;"></i>
                  </a>
                  <a href="#" class="deleteBtn ml-2" data-id="${data.item_id}">
                    <i class="fas fa-trash-alt text-danger" style="font-size: 20px;"></i>
                  </a>`;
              }
            }
          }
        ]
      });

      $('#itemSubmit').click(function (e) {
        e.preventDefault();
        const formData = new FormData($('#iform')[0]);
        $.ajax({
          url: baseUrl,
          method: 'POST',
          data: formData,
          contentType: false,
          processData: false,
          success: function () {
            Swal.fire('Success', 'Item created!', 'success');
            $('#itemModal').modal('hide');
            table.ajax.reload();
          },
          error: function (err) {
            console.error(err);
            Swal.fire('Error', 'Item creation failed.', 'error');
          }
        });
      });

      $('#itable tbody').on('click', '.editBtn', function (e) {
        e.preventDefault();
        const id = $(this).data('id');
        $('#itemSubmit').hide();
        $('#itemUpdate').show();
        $('#itemPreview').empty();

        $.get(`${baseUrl}/${id}`, function (res) {
          const item = res.result[0];
          $('#itemId').val(item.item_id);
          $('#name').val(item.item_name);
          $('#desc').val(item.description);
          $('#sell').val(item.sell_price);
          $('#cost').val(item.cost_price);
          $('#qty').val(item.quantity);
          $('#category').val(item.category_id);

          // ✅ Show all images, not just main one
          const images = [...new Set(item.all_images || [])]; // Deduplicate just in case
          const previews = images.map(img => `<img src="${imageBaseUrl}${img}" width="100" class="mr-2 mb-2" onerror="this.src='${imageBaseUrl}placeholder.jpg'; this.onerror=null;" />`).join('');
          $('#itemPreview').html(previews);

          $('#itemModal').modal('show');
        }).fail(function () {
          Swal.fire('Error', 'Failed to fetch item data.', 'error');
        });
      });

      $('#itemUpdate').click(function (e) {
        e.preventDefault();
        const id = $('#itemId').val();
        const formData = new FormData($('#iform')[0]);
        $.ajax({
          url: `${baseUrl}/${id}`,
          method: 'PUT',
          data: formData,
          contentType: false,
          processData: false,
          success: function () {
            Swal.fire('Updated', 'Item updated successfully.', 'success');
            $('#itemModal').modal('hide');
            table.ajax.reload();
          },
          error: function (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to update item.', 'error');
          }
        });
      });

      $('#itable tbody').on('click', '.deleteBtn', function (e) {
        e.preventDefault();
        const id = $(this).data('id');
        Swal.fire({
          title: 'Are you sure?',
          text: 'This item will be deleted.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, delete it!'
        }).then(result => {
          if (result.isConfirmed) {
            $.ajax({
              url: `${baseUrl}/${id}`,
              method: 'DELETE',
              success: function () {
                Swal.fire('Deleted!', 'Item has been deleted.', 'success');
                table.ajax.reload();
              },
              error: function (err) {
                console.error(err);
                Swal.fire('Error', 'Failed to delete item.', 'error');
              }
            });
          }
        });
      });

      $('#itable tbody').on('click', '.restoreBtn', function (e) {
        e.preventDefault();
        const id = $(this).data('id');
        Swal.fire({
          title: 'Restore Item?',
          text: 'Do you want to restore this item?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Yes, restore it!'
        }).then(result => {
          if (result.isConfirmed) {
            $.ajax({
              url: `http://localhost:3000/api/item/admin/restore/${id}`,
              method: 'PATCH',
              success: function () {
                Swal.fire('Restored!', 'Item has been restored.', 'success');
                $('#itable').DataTable().ajax.reload();
              },
              error: function (err) {
                console.error(err);
                Swal.fire('Error', 'Failed to restore item.', 'error');
              }
            });
          }
        });
      });
    });