$(document).ready(function () {
    const url = 'http://localhost:3000/';

    const table = $('#ctable').DataTable({
        ajax: {
            url: `${url}api/category/admin/all`,
            dataSrc: "data",
        },
        dom: 'Bfrtip',
        buttons: [
            'pdf',
            'excel',
            {
                text: 'Add Category',
                className: 'btn btn-primary',
                action: function () {
                    $("#cform").trigger("reset");
                    $('#categoryModal').modal('show');
                    $('#categoryUpdate').hide();
                    $('#categorySubmit').show();
                    $('#categoryId').remove();
                    $('#category_description').val('');
                }
            }
        ],
        columns: [
            { data: 'category_id' },
            { data: 'description' },
            {
                data: null,
                render: function (data) {
                    let btns = `
                        <a href='#' class='editCategoryBtn' data-id="${data.category_id}">
                            <i class='fas fa-edit' style='font-size:24px'></i>
                        </a>
                        <a href='#' class='deleteCategoryBtn' data-id="${data.category_id}">
                            <i class='fas fa-trash-alt' style='font-size:24px; color:red'></i>
                        </a>`;
                    if (data.deleted_at) {
                        btns += `
                        <a href='#' class='unarchiveCategoryBtn' data-id="${data.category_id}">
                            <i class='fas fa-undo' style='font-size:24px; color:green'></i>
                        </a>`;
                    }
                    return btns;
                }
            }
        ]
    });

    // ✅ Submit new category
    $("#categorySubmit").on('click', function (e) {
        e.preventDefault();
        const formData = { description: $('#category_description').val() };

        $.ajax({
            method: "POST",
            url: `${url}api/category`,
            data: JSON.stringify(formData),
            contentType: "application/json",
            success: function () {
                $("#categoryModal").modal("hide");
                table.ajax.reload();
            },
            error: function (err) {
                console.log(err);
            }
        });
    });

    // ✅ Edit category button
    $('#ctable tbody').on('click', 'a.editCategoryBtn', function (e) {
        e.preventDefault();
        $("#cform").trigger("reset");
        $('#categoryId').remove();

        const id = $(this).data('id');
        $('<input>').attr({ type: 'hidden', id: 'categoryId', name: 'category_id', value: id }).appendTo('#cform');

        $('#categoryModal').modal('show');
        $('#categorySubmit').hide();
        $('#categoryUpdate').show();

        $.ajax({
            method: "GET",
            url: `${url}api/category/${id}`,
            dataType: "json",
            success: function (data) {
                const { result } = data;
                $('#category_description').val(result[0].description);
            },
            error: function () {
                bootbox.alert("Error loading category data.");
            }
        });
    });

    // ✅ Update category
    $("#categoryUpdate").on('click', function (e) {
        e.preventDefault();
        const id = $('#categoryId').val();
        const formData = { description: $('#category_description').val() };

        if (!formData.description.trim()) {
            bootbox.alert("Please enter a category description.");
            return;
        }

        $.ajax({
            method: "PUT",
            url: `${url}api/category/${id}`,
            data: JSON.stringify(formData),
            contentType: "application/json",
            success: function () {
                $('#categoryModal').modal("hide");
                table.ajax.reload();
                bootbox.alert("Category updated successfully!");
            },
            error: function (xhr) {
                const errorMessage = xhr.responseJSON?.error || "Error updating category.";
                bootbox.alert(errorMessage);
            }
        });
    });

    // ✅ Delete category
    $('#ctable tbody').on('click', 'a.deleteCategoryBtn', function (e) {
        e.preventDefault();
        const id = $(this).data('id');

        bootbox.confirm({
            message: "Are you sure you want to delete this category?",
            buttons: {
                confirm: { label: 'Yes', className: 'btn-success' },
                cancel: { label: 'No', className: 'btn-danger' }
            },
            callback: function (result) {
                if (result) {
                    $.ajax({
                        method: "DELETE",
                        url: `${url}api/category/${id}`,
                        success: function (data) {
                            table.ajax.reload();
                            bootbox.alert(data.message || "Category deleted successfully!");
                        },
                        error: function (xhr) {
                            const errorMessage = xhr.responseJSON?.error || "Error deleting category.";
                            bootbox.alert(errorMessage);
                        }
                    });
                }
            }
        });
    });

    // ✅ Restore category
    $('#ctable tbody').on('click', 'a.unarchiveCategoryBtn', function (e) {
        e.preventDefault();
        const id = $(this).data('id');

        $.ajax({
            method: "PUT",
            url: `${url}api/category/restore/${id}`,
            success: function () {
                table.ajax.reload();
                bootbox.alert("Category restored successfully!");
            },
            error: function (xhr) {
                const errorMessage = xhr.responseJSON?.error || "Error restoring category.";
                bootbox.alert(errorMessage);
            }
        });
    });
});
