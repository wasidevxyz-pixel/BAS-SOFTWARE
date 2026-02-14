// Sidebar Navigation - Hybrid Mode (Accordion for Full, Popover for Mini) - VERSION 2.0 UPDATED

class SidebarNavigation {
    constructor() {
        if (window.hasSidebarNavigation) return;
        window.hasSidebarNavigation = true;

        this.currentPage = this.getCurrentPage();
        this.userRole = this.getUserRole();
        // Default to mini mode on ALL pages as per user request
        this.mode = 'mini';

        this.init();
    }

    init() {
        this.injectStyles();
        this.createSidebar();
        this.applyBodyClass();
        this.highlightCurrentPage();
        this.buildStandardHeader(); // Brand new global header standard
        this.injectReportsBackButton(); // Add back button only to reports
        this.setupEventListeners();
        this.setupRoleBasedAccess();
        this.refreshPermissions();
        this.setupHeader();
    }

    buildStandardHeader() {
        // This function forces a consistent look across ALL pages:
        // Left: Menu + Back | Center: Title | Right: Action Buttons + Profile
        setTimeout(() => {
            const pageHeader = document.querySelector('.page-header');
            if (!pageHeader) return;

            // 1. Capture existing buttons before we wipe the header
            const existingButtons = Array.from(pageHeader.querySelectorAll('button, .btn:not(.btn-header-light):not(.btn-header-info)'));
            const originalTitle = document.title.split('-')[0].trim();
            const h4 = pageHeader.querySelector('h1, h2, h3, h4, h5, h6, .header-title-text, .page-title');
            const titleText = h4 ? (h4.innerText || h4.textContent) : originalTitle;

            // 2. Setup clean zones with an Action Zone for page-specific buttons
            pageHeader.className = "page-header d-flex align-items-center justify-content-between px-3 shadow-sm";
            pageHeader.style.cssText = 'height: 55px !important; background: linear-gradient(135deg, #1e4c8c 0%, #2c5ba9 100%) !important; border: none !important; z-index: 1045; padding: 0 10px !important; color: white !important;';

            pageHeader.innerHTML = `
                <div id="header-left-zone" style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 100px;">
                    <div id="sidebarToggleBtnHeader" style="height: 38px; padding: 0 12px; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; cursor: pointer; color: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); transition: all 0.2s;">
                        <i class="fas fa-bars" style="font-size: 1rem;"></i>
                        <span style="font-weight: 700; font-size: 0.75rem; letter-spacing: 0.5px; text-transform: uppercase;">Menu</span>
                    </div>
                </div>
                <div id="header-center-zone" style="flex: 1.5; text-align: center; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                    <span id="globalHeaderTitle" style="font-weight: 700; font-size: 0.95rem; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.5px;">
                        ${titleText}
                    </span>
                </div>
                <div id="header-action-zone" style="flex: 2; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <!-- Original buttons will be moved here -->
                </div>
                <div id="header-right-zone" style="display: flex; align-items: center; justify-content: flex-end; flex: 1; min-width: 80px;">
                    <div class="dropdown">
                        <div class="d-flex align-items-center profile-trigger" data-bs-toggle="dropdown" style="cursor: pointer; background: rgba(255,255,255,0.15); padding: 5px 8px; border-radius: 25px; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1);">
                            <div class="user-avatar-circle-header" style="width: 26px; height: 26px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 8px; overflow: hidden;">
                                <i class="fas fa-user" style="color: #1e4c8c; font-size: 0.8rem;"></i>
                            </div>
                            <span id="standardUserName" class="d-none d-md-inline" style="font-size: 0.8rem; font-weight: 600; margin-right: 5px;">User</span>
                            <i class="fas fa-chevron-down" style="font-size: 0.6rem; opacity: 0.8;"></i>
                        </div>
                        <ul class="dropdown-menu dropdown-menu-end border-0 shadow-lg mt-2" style="border-radius: 12px; min-width: 200px; padding: 10px;">
                            <li class="px-3 py-2 border-bottom mb-2">
                                <div id="standardUserNameFull" style="font-weight: 700; color: #1e4bc8; font-size: 0.9rem;">User Account</div>
                                <div id="standardUserRoleDisplay" style="font-size: 0.75rem; color: #666; text-transform: capitalize;">Role</div>
                            </li>
                            <li><a class="dropdown-item py-2 rounded" href="/main.html"><i class="fas fa-home me-2 text-muted"></i>Dashboard Home</a></li>
                            <li><a class="dropdown-item py-2 rounded" href="/profile.html"><i class="fas fa-user-circle me-2 text-muted"></i>My Profile</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item py-2 rounded text-danger logout-btn" href="#"><i class="fas fa-sign-out-alt me-2"></i>Sign Out Permanently</a></li>
                        </ul>
                    </div>
                </div>
            `;

            // 3. Re-inject the captured buttons into the action zone
            const actionZone = pageHeader.querySelector('#header-action-zone');
            existingButtons.forEach(btn => {
                // Style cleanup for the new header
                btn.classList.add('btn-sm');
                btn.style.margin = '0';
                btn.style.whiteSpace = 'nowrap';
                actionZone.appendChild(btn);
            });

            // Attach toggle event specifically to the new header button
            const headerToggleBtn = pageHeader.querySelector('#sidebarToggleBtnHeader');
            if (headerToggleBtn) {
                headerToggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSidebarMode();
                });
            }

            // Sync user data
            this.setupHeader();
        }, 150);
    }

    injectReportsBackButton() {
        // Detect if we are on a report-related page
        const path = window.location.pathname.toLowerCase();

        // Skip setup screens and vouchers
        if (path.includes('voucher') || path.includes('setup') || path.includes('registration')) return;

        const isReportPage = path.includes('report') ||
            path.includes('ledger') ||
            path.includes('balance') ||
            path.includes('statement') ||
            path.includes('audit');

        if (path.includes('reports.html')) return;
        if (!isReportPage) return;

        // Use a longer delay to wait for buildStandardHeader to finish
        setTimeout(() => {
            const leftZone = document.getElementById('header-left-zone');
            if (!leftZone) return;

            const btn = document.createElement('a');
            // Logic: If it's a Stock Audit Entry, back should go to Dashboard or Audit List.
            // For now, Dashboard is the safest 'Exit' point.
            btn.href = path.includes('stock-audit') ? '/main.html' : '/reports.html';
            btn.className = 'btn btn-sm btn-light reports-hub-btn';
            btn.style.cssText = 'display: flex !important; align-items: center; justify-content: center; color: #1e4c8c !important; font-weight: bold; background: white !important; border: 1px solid #ddd; width: 38px; height: 38px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
            btn.innerHTML = '<i class="fas fa-arrow-left"></i>';
            btn.title = path.includes('stock-audit') ? 'Back to Dashboard' : 'Back to Reports Hub';

            leftZone.appendChild(btn);
        }, 350);
    }

    async refreshPermissions() {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch('/api/v1/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const updatedUser = await response.json();
                // Update local storage with fresh data
                localStorage.setItem('user', JSON.stringify(updatedUser));
                // Re-run permission check with new data
                this.setupRoleBasedAccess();
                this.setupHeader(); // Update avatar/name if changed
            }
        } catch (error) {
            console.error('Sidebar: Failed to refresh permissions', error);
        }
    }

    injectStyles() {
        if (document.getElementById('sidebar-styles')) return;
        const style = document.createElement('style');
        style.id = 'sidebar-styles';
        style.innerHTML = `
            .auth-hidden { display: none !important; }
            .active-parent { background-color: rgba(255,255,255,0.05) !important; color: white !important; }
            
            /* GLOBAL HEADER NORMALIZATION AND PURGE */
            /* Hide manual sidebar toggles in the header as requested */
            #sidebarToggle, #sidebarToggleBtn, .page-header .fa-bars {
                display: none !important;
            }

            .page-header div {
                background: transparent !important; /* Remove manual background on inner divs */
            }

            .user-avatar-small i {
                font-size: 0.8rem;
            }

            .profile-trigger:hover {
                background: rgba(255,255,255,0.25) !important;
            }

            @media (max-width: 768px) {
                .header-title-text {
                    font-size: 0.9rem !important;
                }
            }

            /* Desktop Hover Effects */
            .reports-hub-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
        `;
        document.head.appendChild(style);
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path.includes('index.html')) return 'main';
        const page = path.split('/').pop().replace('.html', '');
        return page || 'main';
    }

    getUserRole() {
        const user = this.getCurrentUser();
        return user ? user.role : 'guest';
    }

    getCurrentUser() {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) return JSON.parse(userStr);
        } catch (error) { console.error(error); }
        return null;
    }

    applyBodyClass() {
        document.body.classList.remove('sidebar-full', 'sidebar-mini');
        document.body.classList.add(this.mode === 'full' ? 'sidebar-full' : 'sidebar-mini');
    }

    createSidebar() {
        const sidebar = document.createElement('nav');
        sidebar.id = 'sidebar';
        sidebar.className = `sidebar-container ${this.mode}`;

        // Attempt to load company logo
        // (Moved loadCompanyLogo call to end of function to ensure DOM elements exist)

        const menuItems = [
            {
                id: 'main', icon: 'fa-home', label: 'Home & Overview', permission: 'dashboard',
                children: [
                    { label: 'Home Page', link: '/main.html', permission: 'dashboard' },
                    { label: 'Dashboard', link: '/dashboard.html', permission: 'dashboard' }
                ]
            },
            {
                id: 'admin', icon: 'fa-cogs', label: 'Administration', permission: 'administration',
                children: [
                    { label: 'User Management', link: '/users.html', permission: 'users' },
                    { label: 'Group Rights', link: '/groups.html', permission: 'groups' },
                    { label: 'System Logs', link: '/system-logs.html', permission: 'system_logs' },
                    { label: 'Stores', link: '/stores.html', permission: 'stores' },
                    { label: 'Parties', link: '/parties.html', permission: 'parties' },
                    { label: 'Commission Item', link: '/commission-item.html', permission: 'commission_item' },
                    { label: 'WHT Supplier', link: '/wht-supplier.html', permission: 'wht_supplier_link' }
                ]
            },
            {
                id: 'accounts', icon: 'fa-calculator', label: 'Accounts', permission: 'accounts',
                children: [
                    { label: 'Supplier Voucher', link: '/payment-vouchers.html?tab=supplier', permission: 'pv_supplier' },
                    { label: 'Category Voucher', link: '/payment-vouchers.html?tab=category', permission: 'pv_category' },
                    { label: 'Vouchers', link: '/voucher.html', permission: 'vouchers' },
                    { label: 'Expenses', link: '/expenses.html', permission: 'expenses' },
                    { label: 'Account Register', link: '/accounts.html', permission: 'account_register' },
                    { label: 'Account Groups', link: '/account-groups.html', permission: 'account_groups' },
                    { label: 'Account Categories', link: '/account-categories.html', permission: 'account_categories' },
                    {
                        id: 'closing-sub',
                        label: 'Closing',
                        icon: 'fa-file-invoice-dollar',
                        permission: 'closing',
                        submenu: [
                            { label: 'Branch Departments', link: '/branch-departments.html', permission: 'branch_departments' },
                            { label: 'Daily Cash', link: '/daily-cash.html', permission: 'daily_cash' },
                            { label: 'Cash Counter', link: '/cash-counter.html', permission: 'cash_counter' },
                            { label: 'Closing Sheet', link: '/closing-sheet.html', permission: 'closing_sheet' },
                            { label: 'Zakat Entry', link: '/zakat.html', permission: 'zakat_entry' }
                        ]
                    }
                ]
            },
            {
                id: 'warehouse', icon: 'fa-warehouse', label: 'Warehouse', permission: 'warehouse',
                children: [
                    { label: 'WH Supplier', link: '/wh-supplier.html', permission: 'wh_supplier' },
                    { label: 'WH Customer', link: '/wh-customer.html', permission: 'wh_customer' },
                    { label: 'Item Registration', link: '/wh-item.html', permission: 'wh_item' },
                    { label: 'WH Purchase', link: '/wh-purchase.html', permission: 'wh_purchase' },
                    { label: 'WH Purchase Return', link: '/wh-purchase-return.html', permission: 'wh_purchase_return' },
                    { label: 'WH Sale Entry', link: '/wh-sale.html', permission: 'wh_sale' },
                    { label: 'WH Sale Entry Return', link: '/wh-sale-return.html', permission: 'wh_sale_return' },
                    { label: 'WH Customer Payment', link: '/wh-customer-payment.html', permission: 'wh_customer_payment' },
                    { label: 'Barcode Printing', link: '/wh-barcode.html', permission: 'wh_barcode_print' },
                    { label: 'WH Stock Audit', link: '/wh-stock-audit.html', permission: 'wh_stock_audit' }
                ]
            },
            {
                id: 'payroll', icon: 'fa-users', label: 'Payroll', permission: 'payroll',
                children: [
                    { label: 'Employee Registration', link: '/employee-registration.html', permission: 'employee_registration' },
                    { label: 'Attendance', link: '/attendance-list.html', permission: 'attendance' },
                    { label: 'Employee Advance', link: '/employee-advance.html', permission: 'employee_advance' },
                    { label: 'Monthly Payroll', link: '/payroll.html', permission: 'monthly_payroll' },
                    { label: 'Holy Days', link: '/holy-days.html', permission: 'holy_days' },
                    { label: 'Employee Penalty', link: '/employee-penalty.html', permission: 'employee_penalty' },
                    { label: 'Emp. Commission', link: '/employee-commission.html', permission: 'emp_commission' },
                    { label: 'UG Emp. Commission', link: '/employee-sale-commission.html', permission: 'ug_emp_commission' },
                    { label: 'Emp. Clearance', link: '/employee-clearance.html', permission: 'emp_clearance' },
                    { label: 'Emp. Adjustment', link: '/employee-adjustment.html', permission: 'emp_adjustment' }
                ]
            },

            {
                id: 'bank-mgmt', icon: 'fa-university', label: 'Bank Management', permission: 'bank_mgmt',
                children: [
                    { label: 'Banks', link: '/banks.html', permission: 'banks' },
                    { label: 'Bank Management', link: '/bank-management.html', permission: 'bank_management' },
                ]
            },
            { id: 'reports', icon: 'fa-chart-bar', label: 'Reports', link: '/reports.html', permission: 'reports' },
            {
                id: 'sales', icon: 'fa-shopping-cart', label: 'Sales', permission: 'sales',
                children: [
                    { label: 'Customer Demand', link: '/customer-demand.html', permission: 'customer_demand' },
                    { label: 'New Sale', link: '/sales.html', permission: 'new_sale' },
                    { label: 'Sales Return', link: '/sale-returns.html', permission: 'sale_returns' },
                    { label: 'Customer Receipt', link: '/customer-payments.html', permission: 'customer_receipt' }
                ]
            },
            {
                id: 'purchases', icon: 'fa-shopping-bag', label: 'Purchase', permission: 'purchase',
                children: [
                    { label: 'New Purchase', link: '/purchases.html', permission: 'new_purchase' },
                    { label: 'Purchase Return', link: '/purchase-returns.html', permission: 'purchase_returns' },
                    { label: 'Supplier Payment', link: '/supplier-payments.html', permission: 'supplier_payment' },
                    { label: 'Supplier WH Tax', link: '/supplier-wh-tax.html', permission: 'supplier_wh_tax_link' },
                    { label: 'Exemption Invoices', link: '/exemption-invoices.html', permission: 'exemption_invoices_link' }
                ]
            },
            {
                id: 'stock', icon: 'fa-warehouse', label: 'Stock', permission: 'stock',
                children: [
                    { label: 'Stock Adjustments', link: '/stock-adjustments.html', permission: 'stock_adjustments' }
                ]
            },
            {
                id: 'settings', icon: 'fa-cog', label: 'Settings', permission: 'settings',
                children: [
                    { label: 'Company Settings', link: '/settings.html?tab=company', permission: 'settings_company' },
                    { label: 'Invoice Settings', link: '/settings.html?tab=invoice', permission: 'settings_invoice' },
                    { label: 'Tax Settings', link: '/settings.html?tab=tax', permission: 'settings_tax' },
                    { label: 'Backup Settings', link: '/settings.html?tab=backup', permission: 'settings_backup' },
                    { label: 'API Key Settings', link: '/settings.html?tab=apiKey', permission: 'settings_apiKey' }
                ]
            }
        ];

        let html = `
            <div class="sidebar-header">
                <i class="fas fa-bars text-white" style="cursor:pointer; font-size: 1.5rem;" id="sidebarToggleBtn"></i>
                <div class="logo-container ms-2">
                    <div class="logo-text d-none d-md-block">BAS</div>
                </div>
            </div>
            
            <div class="user-info-mini">
                <div class="user-avatar-circle" id="sidebarAvatarContainer">
                    <!-- Default User Icon (fallback) -->
                    <i class="fas fa-user" id="defaultUserIcon"></i>
                    <!-- Logo will be injected here via JS -->
                    <img id="sidebarCompanyLogo" src="" alt="Logo" style="display:none; width: 80%; height: 80%; object-fit: contain;">
                </div>
            </div>

            <div class="sidebar-menu">
                <ul class="list-unstyled">
        `;

        menuItems.forEach(item => {
            html += `<li class="nav-item" data-permission="${item.permission}">`;

            if (item.children) {
                // 1. Accordion Trigger (For Full Mode)
                html += `
                    <div class="nav-link collapsed" data-bs-toggle="collapse" href="#submenu-${item.id}" data-bs-target="#submenu-${item.id}" role="button" aria-expanded="false">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                        <i class="fas fa-chevron-right ms-auto arrow arrow-icon" style="font-size: 0.8rem; opacity: 0.7;"></i>
                    </div>
                `;

                // 2. Accordion Content (For Full Mode)
                html += `
                    <ul class="collapse list-unstyled ps-3 submenu-inline" id="submenu-${item.id}">
                `;
                item.children.forEach(child => {
                    if (child.submenu) {
                        // Nested Submenu Logic - with chevron arrows centered
                        html += `
                            <li><a href="javascript:void(0)" class="nav-link small-link" data-permission="${child.permission}" data-target="submenu-${child.id}" onclick="document.getElementById('submenu-${child.id}').classList.toggle('show')" style="font-weight: normal !important; display: flex !important; align-items: center !important; justify-content: space-between !important; padding-left: 25px !important; padding-right: 15px !important;">
                                <span><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${child.label}</span>
                                <i class="fas fa-chevron-right" style="font-size:0.7rem;"></i>
                            </a></li>
                            <ul class="collapse list-unstyled submenu-inline" id="submenu-${child.id}" style="margin-left: 25px !important; padding-left: 0 !important;">
                        `;
                        child.submenu.forEach(subItem => {
                            const permAttr = subItem.permission ? `data-permission="${subItem.permission}"` : '';
                            html += `<li><a href="${subItem.link}" class="nav-link small-link" ${permAttr} style="padding-right: 15px;"><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${subItem.label}</a></li>`;
                        });
                        html += `</ul>`;
                    } else if (child.header) {
                        html += `<li class="sidebar-sub-header text-white text-uppercase fw-bold" style="font-size:0.7rem; padding: 5px 15px; margin-top:5px; opacity: 0.7;">${child.label}</li>`;
                    } else {
                        html += `<li><a href="${child.link}" class="nav-link small-link" data-permission="${child.permission}"><i class="fas fa-circle bullet text-danger" style="font-size:0.5rem; margin-right:8px;"></i>${child.label}</a></li>`;
                    }
                });
                html += `</ul>`;

                // 3. Popover Content (For Mini Mode)
                html += `<div class="popover-menu">
                    <div class="popover-header">
                        ${item.label}
                    </div>
                    <div class="popover-content">
                `;
                item.children.forEach(child => {
                    if (child.submenu) {
                        // Collapsible Submenu for Popover - styled like regular items
                        html += `
                            <div class="popover-submenu-toggle" data-permission="${child.permission}" data-target="popover-sub-${child.id}" style="cursor:pointer; padding: 8px 20px; color:#b8c7ce; display:flex; align-items:center; transition: color 0.2s;">
                                <i class="fas fa-circle bullet" style="font-size:0.5rem; margin-right:10px; color:#e74c3c;"></i>
                                <span style="font-size:0.9rem;">${child.label}</span>
                                <i class="fas fa-chevron-right arrow" style="font-size:0.7rem; margin-left: auto; transition: transform 0.2s;"></i>
                            </div>
                            <div id="popover-sub-${child.id}" class="popover-submenu-content">
                        `;
                        child.submenu.forEach(subItem => {
                            const permAttr = subItem.permission ? `data-permission="${subItem.permission}"` : '';
                            if (subItem.submenu) {
                                // Nested Submenu in Popover
                                const subId = subItem.id || `sub-${Math.random().toString(36).substr(2, 9)}`;
                                html += `
                                    <div class="popover-submenu-toggle" ${permAttr} data-target="popover-sub-${subId}" style="cursor:pointer; padding: 6px 30px; color:#b8c7ce; display:flex; align-items:center;">
                                        <i class="fas fa-circle bullet" style="font-size:0.4rem; margin-right:10px; color:#e67e22;"></i>
                                        <span style="font-size:0.85rem;">${subItem.label}</span>
                                        <i class="fas fa-chevron-right arrow" style="font-size:0.6rem; margin-left: auto;"></i>
                                    </div>
                                    <div id="popover-sub-${subId}" class="popover-submenu-content">
                                `;
                                subItem.submenu.forEach(deepItem => {
                                    const dPerm = deepItem.permission ? `data-permission="${deepItem.permission}"` : '';
                                    html += `<a href="${deepItem.link}" class="popover-item" ${dPerm} style="padding-left: 45px;"><i class="fas fa-circle bullet" style="font-size:0.35rem; margin-right:8px; color:#f1c40f;"></i> ${deepItem.label}</a>`;
                                });
                                html += `</div>`;
                            } else {
                                html += `
                                    <a href="${subItem.link}" class="popover-item" ${permAttr} style="padding-left: 30px;">
                                        <i class="fas fa-circle bullet" style="font-size:0.4rem; margin-right:10px; color:#e74c3c;"></i> ${subItem.label}
                                    </a>
                                `;
                            }
                        });
                        html += `</div>`;
                    } else if (child.header) {
                        html += `<div class="popover-sub-header text-white text-uppercase fw-bold" style="font-size:0.7rem; padding: 5px 15px; margin-top:5px; border-bottom: 1px solid rgba(255,255,255,0.1); opacity: 0.7;">${child.label}</div>`;
                    } else {
                        html += `
                            <a href="${child.link}" class="popover-item" data-permission="${child.permission}">
                                <i class="fas fa-circle bullet" style="font-size:0.5rem; margin-right:10px; color:#e74c3c;"></i> ${child.label}
                            </a>
                        `;
                    }
                });
                html += `</div></div>`;

            } else {
                html += `
                    <a href="${item.link}" class="nav-link" data-page="${item.id}" data-permission="${item.permission}">
                        <i class="fas ${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `;
            }
            html += `</li>`;
        });

        html += `   </ul>
                </div>
        `;

        sidebar.innerHTML = html;
        document.body.prepend(sidebar);

        // Load logo NOW that the elements are in the DOM
        this.loadCompanyLogo();

        // Add Backdrop for mobile
        const backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', () => this.toggleSidebarMode());
    }

    setupEventListeners() {
        // Broad delegation for toggle buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('#sidebarToggle') || e.target.closest('#sidebarToggleBtn')) {
                e.preventDefault();
                this.toggleSidebarMode();
            }
        });

        // Popover Submenu Toggle (Delegated)
        document.addEventListener('click', (e) => {
            const toggle = e.target.closest('.popover-submenu-toggle');
            if (toggle) {
                e.preventDefault();
                e.stopPropagation();
                const targetId = toggle.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                const icon = toggle.querySelector('.arrow');

                if (targetEl) {
                    const isShown = targetEl.classList.contains('show');
                    // Close other submenus at the SAME level if desired, but for now just toggle
                    targetEl.classList.toggle('show');
                    if (icon) {
                        icon.style.transform = !isShown ? 'rotate(90deg)' : 'rotate(0deg)';
                    }
                }
            }
        });

        // Close sidebar on mobile when link is clicked
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return;

            const navLink = e.target.closest('.nav-link:not([data-bs-toggle])');
            const popoverItem = e.target.closest('.popover-item');

            // Prevent closing if it's a submenu toggle (href="javascript:void(0)" or "#")
            if (navLink) {
                const href = navLink.getAttribute('href');
                if (href === 'javascript:void(0)' || href === '#') return;
            }

            if (navLink || popoverItem) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                if (sidebar) sidebar.classList.remove('show-mobile');
                if (backdrop) backdrop.classList.remove('show');

                // Add specific logic to reset menus when navigating
                this.collapseAllMenus();
            }
        });

        // Mobile Fix: Force expand accordion on click for mobile
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return;

            const toggle = e.target.closest('[data-bs-toggle="collapse"]');
            if (toggle) {
                // If it's a sidebar toggle, we might need to verify if the mini mode is interfering
                const targetId = toggle.getAttribute('href') || toggle.getAttribute('data-bs-target');
                if (targetId) {
                    const targetEl = document.querySelector(targetId);
                    // Bootstrap might lag or conflict with our 'mini' class logic. 
                    // Let's ensure the class 'show' is toggled.
                    // However, bootstrap js should handle this. 
                    // The issue is likely CSS hiding it despite 'show' class.
                    // We fixed CSS, but let's double check if we need to force anything here.

                    // Actually, if we are in Mini mode, the click might not be triggering bootstrap collapse 
                    // because the element might be visually different or hidden?

                    // If we need to force open specifically for mobile:
                    if (targetEl && targetEl.classList.contains('submenu-inline')) {
                        setTimeout(() => {
                            if (!targetEl.classList.contains('show')) {
                                // Ideally bootstrap opens it. If not, we force display block via style
                            }
                        }, 50);
                    }
                }
            }
        });
    }

    toggleSidebarMode() {
        const isMobile = window.innerWidth <= 768;
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');

        if (isMobile) {
            sidebar.classList.toggle('show-mobile');
            const isOpen = sidebar.classList.contains('show-mobile');

            if (backdrop) backdrop.classList.toggle('show');

            // If we just CLOSED it, or if toggling generally, ensure we reset if closing
            if (!isOpen) {
                this.collapseAllMenus();
            }
            return;
        }

        if (this.mode === 'full') {
            this.mode = 'mini';
            sidebar.classList.remove('full');
            sidebar.classList.add('mini');

            // Collapse all menus when minimizing so they are closed when re-opened
            this.collapseAllMenus();
        } else {
            this.mode = 'full';
            sidebar.classList.remove('mini');
            sidebar.classList.add('full');
        }
        this.applyBodyClass();
    }

    highlightCurrentPage() {
        let path = window.location.pathname;
        if (path === '/') path = '/main.html';

        // Normalize for comparison (remove leading slash if inconsistent)
        const normalize = (p) => p.startsWith('/') ? p : '/' + p;
        const currentPath = normalize(path);

        // Clean highlight
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active');
            // If it's a parent trigger, ensure it's collapsed visually if not active
            if (l.hasAttribute('data-bs-toggle')) {
                l.classList.add('collapsed');
                l.setAttribute('aria-expanded', 'false');
            }
        });
        document.querySelectorAll('.submenu-inline').forEach(ul => ul.classList.remove('show'));

        const allLinks = document.querySelectorAll('a');
        let matched = false;

        allLinks.forEach(a => {
            const linkHref = a.getAttribute('href');
            if (!linkHref || linkHref === 'javascript:void(0)' || linkHref === '#') return;

            // Robust Match: Exact or EndsWith
            if (normalize(linkHref) === currentPath) {
                matched = true;
                a.classList.add('active');

                // Highlight and Expand Parent Accordion
                const parentUl = a.closest('.submenu-inline');
                if (parentUl) {
                    // Mobile Behavior: Do NOT auto-expand. Keep it collapsed by default.
                    // Desktop Behavior: Auto-expand to show context.
                    if (window.innerWidth > 768) {
                        parentUl.classList.add('show'); // Expand accordion

                        // Find trigger for this UL
                        const trigger = document.querySelector(`[data-bs-target="#${parentUl.id}"], [href="#${parentUl.id}"]`);
                        if (trigger) {
                            trigger.classList.add('active-parent'); // Custom highlight style
                            trigger.classList.remove('collapsed'); // Rotate arrow
                            trigger.setAttribute('aria-expanded', 'true'); // A11y
                        }

                        // Handle Nested Parents (Grandparents)
                        const grandParentUl = parentUl.parentElement.closest('.submenu-inline');
                        if (grandParentUl) {
                            grandParentUl.classList.add('show');
                            const gpTrigger = document.querySelector(`[data-bs-target="#${grandParentUl.id}"], [href="#${grandParentUl.id}"]`);
                            if (gpTrigger) {
                                gpTrigger.classList.add('active-parent');
                                gpTrigger.classList.remove('collapsed');
                                gpTrigger.setAttribute('aria-expanded', 'true');
                            }
                        }
                    } else {
                        // On Mobile: just ensure the trigger knows it has an active child (optional, for styling)
                        // formatting only, no expansion
                        const trigger = document.querySelector(`[data-bs-target="#${parentUl.id}"], [href="#${parentUl.id}"]`);
                        if (trigger) {
                            trigger.classList.add('active-parent');
                        }
                    }
                }
            }
        });
    }

    setupRoleBasedAccess() {
        console.log('Sidebar: [PERMISSION CHECK] Starting...');
        const user = this.getCurrentUser();
        if (!user) {
            console.warn('Sidebar: No user found in LocalStorage.');
            return;
        }

        // 1. Resolve Rights - Aggressive merging
        let rights = {};
        // STRICT MODE: Do not auto-promote admin role
        // if (user.role === 'admin') rights.admin = true;
        if (user.rights) Object.assign(rights, user.rights);

        // Removed redundant merging of raw group rights to prevent overwriting processed rights from controller
        // if (user.group && user.group.rights) Object.assign(rights, user.group.rights);
        // if (user.groupId && typeof user.groupId === 'object' && user.groupId.rights) Object.assign(rights, user.groupId.rights);

        // Check for Group Admin flag (LOG ONLY, DO NOT BYPASS)
        const isGroupAdmin = (user.group && user.group.isAdmin) || (user.groupId && typeof user.groupId === 'object' && user.groupId.isAdmin);

        // DISABLED BYPASS to enforce granular controls
        /*
        if (user.role === 'admin' || isGroupAdmin || rights.admin === true) {
            console.log('Sidebar: User has Admin status. Full access granted.');
            return;
        }
        */

        console.log('Sidebar: Loaded Rights Keys:', Object.keys(rights).length);
        /*
        if (Object.keys(rights).length === 0) {
            console.warn('Sidebar: No rights found. Keeping sidebar visible to avoid blackout.');
            return;
        }
        */

        // 2. Hide items NOT explicitly authorized (Strict Mode)
        // alert('Sidebar V19 Loaded - Checking Permissions'); // Debug Alert
        const allPermissions = document.querySelectorAll('[data-permission]');
        allPermissions.forEach(el => {
            const perm = el.getAttribute('data-permission');
            // STRICT CHANGE: If perm exists and right is NOT true, HIDE IT.
            // (Previous logic only hid if rights[perm] === false, failing on undefined)
            const isGranted = rights[perm] === true || rights[perm] === 'true';
            if (perm && !isGranted) {
                el.classList.add('auth-hidden');
                el.style.display = 'none';

                // Also hide the LI container if it's a submenu item
                const li = el.closest('li');
                if (li && !li.classList.contains('nav-item')) {
                    li.classList.add('auth-hidden');
                    li.style.display = 'none';
                }
            }
        });

        // 3. FORCE SHOW explicitly authorized items (Rights = True)
        // This overrides any accidental hiding from previous logic
        allPermissions.forEach(el => {
            const perm = el.getAttribute('data-permission');
            if (perm && (rights[perm] === true || rights[perm] === 'true')) {
                el.classList.remove('auth-hidden');
                el.style.display = '';

                const li = el.closest('li');
                if (li) {
                    li.classList.remove('auth-hidden');
                    li.style.display = '';
                }
            }
        });

        // 4. Hierarchical Cleanup & UPWARD PROPAGATION
        // If a child is authorized, the parent MUST show. We run multiple times to propagate up levels.

        // Define helpers
        const isVisible = (el) => {
            return el && !el.classList.contains('auth-hidden') && el.style.display !== 'none';
        };

        const hasVisibleChildren = (container) => {
            // Look for direct links or submenu toggles that are visible
            // We need to look deeper than just immediate children for nested structures
            const links = container.querySelectorAll('a, .popover-item, .popover-submenu-toggle');
            for (let link of links) {
                if (isVisible(link)) return true;
            }
            return false;
        };

        for (let i = 0; i < 6; i++) {
            const containers = document.querySelectorAll('.sidebar-container .nav-item, .sidebar-container .submenu-inline, .sidebar-container .popover-menu, .sidebar-container .popover-submenu-content');
            containers.forEach(container => {
                if (hasVisibleChildren(container)) {
                    // Category has active children! Show it.
                    container.classList.remove('auth-hidden');
                    container.style.display = '';

                    // Also ensure the trigger (the link that opens this container) is shown
                    const id = container.id;
                    if (id) {
                        document.querySelectorAll(`[href="#${id}"], [data-target="${id}"], [data-bs-target="#${id}"]`).forEach(t => {
                            t.classList.remove('auth-hidden');
                            t.style.display = '';
                            // And the LI wrapping that trigger
                            const li = t.closest('li');
                            if (li) { li.classList.remove('auth-hidden'); li.style.display = ''; }
                        });
                    }
                } else {
                    // Container empty - Hide it UNLESS the section itself is expressly authorized
                    const perm = container.getAttribute('data-permission');
                    // Only hide if NOT authorized AND no children
                    if (perm && (rights[perm] === true || rights[perm] === 'true')) {
                        // Keep it visible
                    } else {
                        // If it determines visibility solely by children (like a pure folder), and no children -> hide
                        // Or if explicit permission is false/undefined -> hide

                        // BUT: We must check if we already processed it as visible in a previous loop?
                        // Actually, if hasVisibleChildren is false, we can safely hide it IF it relies on children.
                        // Ideally, we shouldn't hide something that was explicitly true.
                        if (!perm || !rights[perm]) {
                            container.classList.add('auth-hidden');
                            container.style.display = 'none';

                            const id = container.id;
                            if (id) {
                                document.querySelectorAll(`[href="#${id}"], [data-target="${id}"], [data-bs-target="#${id}"]`).forEach(t => {
                                    t.classList.add('auth-hidden');
                                    t.style.display = 'none';
                                    const li = t.closest('li');
                                    if (li) { li.classList.add('auth-hidden'); li.style.display = 'none'; }
                                });
                            }
                        }
                    }
                }
            });
        }


        // 5. FAILSAFE: explicitly unhide items that are definitely allowed
        // This handles cases where parent/child logic might have been too aggressive
        Object.keys(rights).forEach(key => {
            if (rights[key] === true || rights[key] === 'true') {
                const els = document.querySelectorAll(`[data-permission="${key}"]`);
                els.forEach(el => {
                    el.classList.remove('auth-hidden');
                    el.style.display = '';
                    // Also ensure its parent container is visible if it's a submenu item
                    const parent = el.closest('.submenu-inline, .popover-submenu-content');
                    if (parent) {
                        parent.classList.remove('auth-hidden');
                        parent.style.display = '';
                        // And the trigger for that parent
                        const parentId = parent.id;
                        if (parentId) {
                            const trigger = document.querySelector(`[data-target="${parentId}"], [href="#${parentId}"]`);
                            if (trigger) {
                                trigger.classList.remove('auth-hidden');
                                trigger.style.display = '';
                                const li = trigger.closest('li');
                                if (li) { li.classList.remove('auth-hidden'); li.style.display = ''; }
                            }
                        }
                    }
                });
            }
        });

        console.log('Sidebar: [PERMISSION CHECK] Finalized.');
    }

    collapseAllMenus() {
        // Collapse all open submenus
        document.querySelectorAll('.submenu-inline.show').forEach(ul => {
            ul.classList.remove('show');
            // Reset trigger
            const id = ul.id;
            const trigger = document.querySelector(`[href="#${id}"], [data-bs-target="#${id}"]`);
            if (trigger) {
                trigger.classList.add('collapsed');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    setupHeader() {
        const user = this.getCurrentUser();
        if (!user) return;

        // Update all user name displays including the new standard one
        const nameElements = ['userName', 'userNameHeader', 'headerUserName', 'standardUserName', 'standardUserNameFull'];
        nameElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = user.name;
        });

        // Update Account Info in dropdown
        const roleEl = document.getElementById('standardUserRoleDisplay');
        const emailEl = document.getElementById('standardUserEmailDisplay');
        if (roleEl) roleEl.innerText = user.role || 'User';
        if (emailEl) emailEl.innerText = user.email || 'Connected';

        // Built-in Avatar SVGs (same as in profile.html)
        const AVATARS = [
            // Avatar 1 - Blue Professional Male
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#3498db"/><circle cx="50" cy="40" r="20" fill="#f5d0c5"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#2980b9"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 45 47 Q 50 52 55 47" stroke="#333" stroke-width="2" fill="none"/><path d="M 30 25 Q 50 5 70 25 Q 70 35 50 30 Q 30 35 30 25" fill="#4a3728"/></svg>`,
            // Avatar 2 - Pink Professional Female
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#e91e63"/><circle cx="50" cy="40" r="20" fill="#f5d0c5"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#c2185b"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 45 47 Q 50 52 55 47" stroke="#c0392b" stroke-width="2" fill="none"/><path d="M 25 35 Q 25 10 50 15 Q 75 10 75 35 Q 70 45 50 55 Q 30 45 25 35" fill="#5d4037"/></svg>`,
            // Avatar 3 - Green Tech Guy
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#27ae60"/><circle cx="50" cy="40" r="20" fill="#fce4d6"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#1e8449"/><rect x="36" y="32" width="10" height="8" rx="2" fill="#333"/><rect x="54" y="32" width="10" height="8" rx="2" fill="#333"/><path d="M 45 48 Q 50 51 55 48" stroke="#333" stroke-width="2" fill="none"/><path d="M 30 28 Q 50 20 70 28 L 65 35 Q 50 30 35 35 Z" fill="#2c3e50"/></svg>`,
            // Avatar 4 - Purple Creative Female
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#9b59b6"/><circle cx="50" cy="40" r="20" fill="#f5d0c5"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#8e44ad"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 43 47 Q 50 53 57 47" stroke="#e74c3c" stroke-width="2" fill="none"/><path d="M 20 40 Q 25 10 50 15 Q 75 10 80 40 Q 75 50 50 60 Q 25 50 20 40" fill="#6c3483"/></svg>`,
            // Avatar 5 - Orange Business Male
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#e67e22"/><circle cx="50" cy="40" r="20" fill="#fce4d6"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#d35400"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 45 47 Q 50 50 55 47" stroke="#333" stroke-width="2" fill="none"/><path d="M 32 30 Q 50 22 68 30 L 65 25 Q 50 18 35 25 Z" fill="#1a1a1a"/><rect x="47" y="60" width="6" height="10" fill="#2c3e50"/></svg>`,
            // Avatar 6 - Teal Doctor/Medical
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#1abc9c"/><circle cx="50" cy="40" r="20" fill="#f5d0c5"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#fff"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 45 47 Q 50 51 55 47" stroke="#333" stroke-width="2" fill="none"/><path d="M 30 25 Q 50 10 70 25 Q 65 30 50 28 Q 35 30 30 25" fill="#2c3e50"/><circle cx="35" cy="70" r="5" fill="#e74c3c"/><rect x="33" y="68" width="4" height="4" fill="#fff"/><rect x="34" y="67" width="2" height="6" fill="#fff"/></svg>`,
            // Avatar 7 - Red Bold Male
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#e74c3c"/><circle cx="50" cy="40" r="20" fill="#fce4d6"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#c0392b"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 44 47 Q 50 52 56 47" stroke="#333" stroke-width="2" fill="none"/><ellipse cx="50" cy="22" rx="22" ry="12" fill="#2c3e50"/></svg>`,
            // Avatar 8 - Indigo Professional Female
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#3f51b5"/><circle cx="50" cy="40" r="20" fill="#f5d0c5"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#303f9f"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 45 47 Q 50 52 55 47" stroke="#e74c3c" stroke-width="2" fill="none"/><path d="M 22 38 Q 28 8 50 12 Q 72 8 78 38 Q 72 48 50 50 Q 28 48 22 38" fill="#1a1a1a"/><circle cx="43" cy="33" r="5" fill="none" stroke="#333" stroke-width="1"/><circle cx="57" cy="33" r="5" fill="none" stroke="#333" stroke-width="1"/></svg>`,
            // Avatar 9 - Cyan Modern Male
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#00bcd4"/><circle cx="50" cy="40" r="20" fill="#fce4d6"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#0097a7"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 45 48 Q 50 52 55 48" stroke="#333" stroke-width="2" fill="none"/><path d="M 30 32 Q 35 15 50 18 Q 65 15 70 32 L 65 28 Q 50 22 35 28 Z" fill="#5d4037"/><rect x="28" y="45" width="6" height="4" rx="1" fill="#ffc107"/></svg>`,
            // Avatar 10 - Amber Casual Female
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#ffc107"/><circle cx="50" cy="40" r="20" fill="#f5d0c5"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#ffa000"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 44 47 Q 50 53 56 47" stroke="#e74c3c" stroke-width="2" fill="none"/><path d="M 25 30 Q 30 5 50 10 Q 70 5 75 30" fill="#ff9800" stroke="none"/><path d="M 25 30 Q 25 45 35 55 L 30 60 Q 20 50 25 30" fill="#ff9800"/><path d="M 75 30 Q 75 45 65 55 L 70 60 Q 80 50 75 30" fill="#ff9800"/></svg>`,
            // Avatar 11 - Navy Executive
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#34495e"/><circle cx="50" cy="40" r="20" fill="#fce4d6"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#2c3e50"/><circle cx="43" cy="37" r="3" fill="#333"/><circle cx="57" cy="37" r="3" fill="#333"/><path d="M 45 47 Q 50 50 55 47" stroke="#333" stroke-width="2" fill="none"/><path d="M 32 28 Q 50 18 68 28 L 66 22 Q 50 14 34 22 Z" fill="#566573"/><path d="M 40 60 L 50 70 L 60 60" fill="#e74c3c"/><rect x="47" y="60" width="6" height="8" fill="#fff"/></svg>`,
            // Avatar 12 - Lime Friendly
            `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#8bc34a"/><circle cx="50" cy="40" r="20" fill="#f5d0c5"/><ellipse cx="50" cy="85" rx="30" ry="25" fill="#689f38"/><circle cx="43" cy="37" r="4" fill="#333"/><circle cx="57" cy="37" r="4" fill="#333"/><circle cx="44" cy="36" r="1.5" fill="#fff"/><circle cx="58" cy="36" r="1.5" fill="#fff"/><path d="M 42 47 Q 50 55 58 47" stroke="#333" stroke-width="2" fill="none"/><path d="M 28 30 Q 35 10 50 12 Q 65 10 72 30 Q 68 35 50 32 Q 32 35 28 30" fill="#5d4037"/></svg>`
        ];

        // Check for saved avatar in localStorage
        const savedAvatarIndex = localStorage.getItem('userAvatar');

        if (savedAvatarIndex !== null && AVATARS[parseInt(savedAvatarIndex)]) {
            const avatarSvg = AVATARS[parseInt(savedAvatarIndex)];

            // Update all user-avatar divs with the selected avatar
            document.querySelectorAll('.user-avatar').forEach(div => {
                div.innerHTML = avatarSvg;
                div.style.background = 'transparent';
                div.classList.remove('bg-primary');
            });

            // Also update headerAvatarDisplay if it exists
            const headerAvatarDisplay = document.getElementById('headerAvatarDisplay');
            if (headerAvatarDisplay) {
                headerAvatarDisplay.innerHTML = avatarSvg;
                headerAvatarDisplay.style.background = 'transparent';
                headerAvatarDisplay.classList.remove('bg-primary');
            }
        } else if (user.profilePicture) {
            // Fallback to profile picture if no built-in avatar selected
            document.querySelectorAll('.user-avatar-img, .header-avatar').forEach(img => {
                img.src = user.profilePicture;
            });

            document.querySelectorAll('.user-avatar').forEach(div => {
                div.innerHTML = `<img src="${user.profilePicture}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                div.classList.remove('bg-primary');
                div.classList.add('bg-white');
            });
        }

        // Setup Logout buttons
        document.querySelectorAll('.logout-btn, #logoutBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.pageAccess && window.pageAccess.logout) {
                    window.pageAccess.logout();
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login.html';
                }
            });
        });
    }

    async loadCompanyLogo() {
        try {
            const img = document.getElementById('sidebarCompanyLogo');
            const defaultIcon = document.getElementById('defaultUserIcon');
            if (!img) return;

            // 1. Try to load from LocalStorage Cache first (Instant Load)
            const cachedLogo = localStorage.getItem('companyLogo_cache');
            if (cachedLogo) {
                img.src = cachedLogo;
                img.style.display = 'block';
                if (defaultIcon) defaultIcon.style.display = 'none';
            }

            // 2. Fetch from API to ensure it's up to date (Background Update)
            const token = localStorage.getItem('token');
            if (!token) return;

            // Only fetch if we don't have a cache OR if it's been a while? 
            // For now, let's fetch always to verify, but the user sees the cached version instantly.
            // Actually, to save bandwidth/time, we can rely on settings updates clearing this cache?
            // Let's simple fetch and update if changed.

            const response = await fetch('/api/v1/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const settings = data.data || data;
                if (settings.logo) {
                    // Update cache if new
                    if (settings.logo !== cachedLogo) {
                        localStorage.setItem('companyLogo_cache', settings.logo);
                        img.src = settings.logo;
                        // On load handled by browser cache usually, but explicit sets help
                        img.onload = () => {
                            img.style.display = 'block';
                            if (defaultIcon) defaultIcon.style.display = 'none';
                        };
                    } else {
                        // Even if cached, ensure visibility just in case
                        if (img.style.display === 'none') {
                            img.style.display = 'block';
                            if (defaultIcon) defaultIcon.style.display = 'none';
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load sidebar logo', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    if (!window.location.pathname.includes('login.html')) {
        new SidebarNavigation();
    }
});
