
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    await loadBranches();
    await loadCategories();
    await loadSuppliers();
    handleSearch(); // Initial filter

    // Branch filter auto-load
    document.getElementById('branch').addEventListener('change', handleSearch);

    // Form submission
    document.getElementById('supplierForm').addEventListener('submit', handleFormSubmit);

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
});

let allSuppliers = [];

// --- API Calls ---

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('branch');
            select.innerHTML = '<option value="">Select Branch</option>';
            data.data.forEach(store => {
                const option = document.createElement('option');
                option.value = store._id;
                option.textContent = store.name;
                select.appendChild(option);
            });
            if (data.data.length === 1) {
                select.value = data.data[0]._id;
            }
        }
    } catch (err) {
        console.error('Error loading branches:', err);
    }
}

let allCategories = [];

async function loadCategories() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/supplier-categories', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allCategories = data.data;
            const select = document.getElementById('category');
            select.innerHTML = '<option value="">Select Supplier Category</option>';

            allCategories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat._id;
                opt.textContent = cat.name;
                select.appendChild(opt);
            });

            renderCategoryModalList();
        }
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

async function loadSuppliers() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/v1/suppliers?limit=1000', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            allSuppliers = data.data;
            renderSupplierTable(allSuppliers);
        }
    } catch (err) {
        console.error('Error loading suppliers:', err);
    }
}

// --- Logic ---

function renderSupplierTable(suppliers) {
    const tbody = document.getElementById('supplierTableBody');
    tbody.innerHTML = '';

    suppliers.forEach((sup, index) => {
        const tr = document.createElement('tr');
        if (sup.isActive) tr.classList.add('active-row');

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="text-start fw-bold">${sup.name}</td>
            <td>${sup.category ? sup.category.name : '-'}</td>
            <td>${sup.subCategory || '-'}</td>
            <td>${sup.phoneNo || '-'}</td>
            <td>${sup.mobileNo || '-'}</td>
            <td>${sup.ntn || '-'}</td>
            <td>${sup.strn || '-'}</td>
            <td>${sup.email || '-'}</td>
            <td>${sup.whtType || '-'}</td>
            <td>${sup.whtPer || 0}%</td>
            <td>${sup.advTaxPer || 0}%</td>
            <td>${sup.address || '-'}</td>
            <td class="${sup.isActive ? 'text-success fw-bold' : 'text-danger'}">${sup.isActive ? 'Active' : 'In-Active'}</td>
            <td>${sup.city || '-'}</td>
            <td>${sup.branch ? sup.branch.name : '-'}</td>
            <td>No</td>
            <td>
                <button class="btn btn-edit btn-sm" onclick="editSupplier('${sup._id}')">Edit</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('supplierId').value;
    const formData = {
        branch: document.getElementById('branch').value,
        name: document.getElementById('name').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        phoneNo: document.getElementById('phoneNo').value,
        mobileNo: document.getElementById('mobileNo').value,
        email: document.getElementById('email').value,
        ntn: document.getElementById('ntn').value,
        strn: document.getElementById('strn').value,
        category: document.getElementById('category').value || undefined,
        subCategory: document.getElementById('subCategory').value,
        whtType: document.getElementById('whtType').value,
        whtPer: parseFloat(document.getElementById('whtPer').value) || 0,
        advTaxPer: parseFloat(document.getElementById('advTaxPer').value) || 0,
        opening: parseFloat(document.getElementById('opening').value) || 0,
        isActive: document.getElementById('isActive').checked
    };

    try {
        const token = localStorage.getItem('token');
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/v1/suppliers/${id}` : '/api/v1/suppliers';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await res.json();
        if (data.success) {
            alert(id ? 'Supplier Updated successfully!' : 'Supplier Saved successfully!');
            clearForm();
            loadSuppliers();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Error saving supplier:', err);
    }
}

window.editSupplier = function (id) {
    const sup = allSuppliers.find(s => s._id === id);
    if (!sup) return;

    document.getElementById('supplierId').value = sup._id;
    document.getElementById('branch').value = sup.branch?._id || sup.branch || ''; // Handle populated or not
    document.getElementById('name').value = sup.name || '';
    document.getElementById('address').value = sup.address || '';
    document.getElementById('city').value = sup.city || 'RWP';
    document.getElementById('phoneNo').value = sup.phoneNo || '';
    document.getElementById('mobileNo').value = sup.mobileNo || '';
    document.getElementById('email').value = sup.email || '';
    document.getElementById('ntn').value = sup.ntn || '';
    document.getElementById('strn').value = sup.strn || '';
    document.getElementById('category').value = sup.category?._id || sup.category || '';
    document.getElementById('subCategory').value = sup.subCategory || '';
    document.getElementById('whtType').value = sup.whtType || 'Monthly';
    document.getElementById('whtPer').value = sup.whtPer || 0;
    document.getElementById('advTaxPer').value = sup.advTaxPer || 0;
    document.getElementById('opening').value = sup.opening || 0;
    document.getElementById('isActive').checked = sup.isActive;

    document.getElementById('saveBtn').textContent = 'Update';
    document.getElementById('deleteBtn').style.display = 'inline-block';

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteSupplier() {
    const id = document.getElementById('supplierId').value;
    if (!id || !confirm('Are you sure you want to delete this supplier?')) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/suppliers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            alert('Supplier Deleted!');
            clearForm();
            loadSuppliers();
        }
    } catch (err) {
        console.error('Error deleting:', err);
    }
}

window.clearForm = function () {
    document.getElementById('supplierForm').reset();
    document.getElementById('supplierId').value = '';
    document.getElementById('saveBtn').textContent = 'Save';
    document.getElementById('deleteBtn').style.display = 'none';
}

function handleSearch() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const branchId = document.getElementById('branch').value;

    const filtered = allSuppliers.filter(s => {
        // Match Search Term
        const matchesTerm = s.name.toLowerCase().includes(term) ||
            (s.ntn && s.ntn.toLowerCase().includes(term)) ||
            (s.category && s.category.name && s.category.name.toLowerCase().includes(term));

        // Match Branch
        const supBranchId = s.branch?._id || s.branch || '';
        const matchesBranch = !branchId || supBranchId === branchId;

        return matchesTerm && matchesBranch;
    });

    renderSupplierTable(filtered);
}

// --- Category Popup ---

function renderCategoryModalList() {
    const tbody = document.getElementById('categoryListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    allCategories.forEach((cat, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td class="fw-bold">${cat.name}</td>
            <td>
                <div class="d-flex justify-content-center gap-1">
                    <button class="btn btn-warning btn-xs" title="Edit" onclick="editCategory('${cat._id}', '${cat.name}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-xs" title="Delete" onclick="deleteCategory('${cat._id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editCategory = function (id, name) {
    document.getElementById('editCategoryId').value = id;
    document.getElementById('newCategoryName').value = name;
    document.getElementById('saveCatBtn').textContent = 'Update Category';
    document.getElementById('cancelCatEditBtn').style.display = 'block';
}

window.cancelCategoryEdit = function () {
    document.getElementById('editCategoryId').value = '';
    document.getElementById('newCategoryName').value = '';
    document.getElementById('saveCatBtn').textContent = 'Save Category';
    document.getElementById('cancelCatEditBtn').style.display = 'none';
}

window.deleteCategory = async function (id) {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/v1/supplier-categories/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            alert('Category Deleted!');
            await loadCategories();
        }
    } catch (err) {
        console.error('Error deleting category:', err);
    }
}

window.openCategoryModal = function () {
    cancelCategoryEdit(); // Reset form
    const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
    modal.show();
}

window.saveCategory = async function () {
    const id = document.getElementById('editCategoryId').value;
    const name = document.getElementById('newCategoryName').value;
    if (!name) return alert('Enter category name');

    try {
        const token = localStorage.getItem('token');
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/v1/supplier-categories/${id}` : '/api/v1/supplier-categories';

        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
            alert(id ? 'Category Updated!' : 'Category Added!');
            cancelCategoryEdit();
            await loadCategories();
        }
    } catch (err) {
        console.error('Error saving category:', err);
    }
}

// Helpers
function isAuthenticated() {
    return localStorage.getItem('token') !== null;
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
