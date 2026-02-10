// Map Frontend IDs to Backend Schema Fields
const FIELD_MAPPING = {
    // Earnings
    overTimeAmount: 'overTime',
    rotiAmount: 'rent',
    rotiDays: 'rotiDays',
    nashtaAmount: 'teaAllowance',
    nashtaDays: 'nashtaDays',
    monthlyComm: 'monthlyComm',
    fixAllowance: 'natin',
    stLessAllow: 'stLateAllow',
    otherAllow: 'otherAllow',

    // Deductions
    tsw: 'ttw',
    tfc: 'fund',
    foodDeduction: 'ugrm',
    securityDeposit: 'securityDeposit',
    penalty: 'penalty',

    // Net Calc
    grossTotal: 'grossTotal',
    netTotal: 'netTotal',
    bankAmt: 'bankAmt',
    wht: 'wht',
    bankPaid: 'bankPaid',
    cashPaid: 'cashPaid',
    balance: 'rebate',
    remarks: 'remarks',
    branchBank: 'branchBank',

    // Header Flags
    payAdvSalary: 'payAdvSalary'
};

let currentPayrollId = null;
let currentListPayrolls = [];
let pendingDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeHeaderUser();
    setDefaultDate();
    loadBranches();
    loadEmployees();

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Alt + S for Save
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            savePayroll();
        }
        // Alt + L for List (Toggle)
        if (e.altKey && (e.key === 'l' || e.key === 'L')) {
            e.preventDefault();
            const modalEl = document.getElementById('payrollListModal');
            let modal = bootstrap.Modal.getInstance(modalEl);
            if (modal && modalEl.classList.contains('show')) {
                modal.hide();
            } else {
                showList();
            }
        }
    });

    // Handle Manual Code Input for Search
    document.getElementById('code').addEventListener('change', async (e) => {
        const code = e.target.value.trim();
        if (code) {
            findEmployeeByCode(code);
        }
    });

    // Handle Enter Key on Code Field
    document.getElementById('code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const code = e.target.value.trim();
            if (code) findEmployeeByCode(code);
        }
    });

    // Add Event Listeners for Calculation
    const calcFields = [
        'overTimeAmount', 'overTimeHrs', 'rotiAmount', 'nashtaAmount', 'monthlyComm',
        'fixAllowance', 'stLessAllow', 'otherAllow',
        'shortTimeAmount', 'shortTimeHrs', 'tsw', 'tfc', 'foodDeduction', 'ebDeduction',
        'umrahDeduction', 'otherDeduction', 'securityDeposit', 'penalty',
        'pAAdv', 'cmAdv', 'totalAdv', 'bankPaid', 'cashPaid', 'checkShortWeek', 'shortWeekDays',
        'payAdvSalary', 'wkDays30', 'salThrBank', 'wht'
    ];

    calcFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculateTotals);
            el.addEventListener('change', calculateTotals);
        }
    });

    // Special handler for 30 Working Days checkbox - force recalculation from backend
    document.getElementById('wkDays30').addEventListener('change', async () => {
        const employeeId = document.getElementById('employee').value;
        const monthYear = document.getElementById('monthYear').value;
        const branch = document.getElementById('branch').value;

        if (employeeId && monthYear) {
            await forceRecalculate(employeeId, monthYear, branch);
        }
    });

    // Handle Employee Selection
    document.getElementById('employee').addEventListener('change', async (e) => {
        const employeeId = e.target.value;
        const monthYear = document.getElementById('monthYear').value;
        const branch = document.getElementById('branch').value;

        if (employeeId && monthYear) {
            await loadOrCalculate(employeeId, monthYear, branch);
        }
    });

    // Handle Month Change
    document.getElementById('monthYear').addEventListener('input', async (e) => {
        const employeeId = document.getElementById('employee').value;
        const monthYear = e.target.value;
        const branch = document.getElementById('branch').value;

        if (employeeId && monthYear) {
            await loadOrCalculate(employeeId, monthYear, branch);
        }
    });

    // Handle Branch Change
    document.getElementById('branch').addEventListener('change', async (e) => {
        const employeeId = document.getElementById('employee').value;
        const monthYear = document.getElementById('monthYear').value;
        const branch = e.target.value;

        // Load Banks for the selected branch
        await loadBranchBanks(branch);

        if (employeeId && monthYear) {
            await loadOrCalculate(employeeId, monthYear, branch);
        }
        // Update Present Count
        GetTotalPresentEmployee();
    });

    // Handle List Search Text
    const listSearchText = document.getElementById('listSearchText');
    if (listSearchText) {
        listSearchText.addEventListener('input', () => {
            renderPayrollTable(currentListPayrolls);
        });
    }

    // Select All Functionality
    const selectAllCheck = document.getElementById('selectAllPayrolls');
    if (selectAllCheck) {
        selectAllCheck.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.payroll-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
    }

    // Enter key for Auth Modal
    document.getElementById('authPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmDelete();
        }
    });
});



function setDefaultDate() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    document.getElementById('monthYear').value = `${year}-${month}`;
}

function initializeHeaderUser() {
    const user = window.getCurrentUser();
    if (user) {
        const nameEl = document.getElementById('headerUserName');
        if (nameEl) nameEl.textContent = user.name || 'User';
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        window.logout();
    }
}

async function loadBranches() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/stores', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const branchSelect = document.getElementById('branch');
            branchSelect.innerHTML = '<option value="">Select Branch</option>';
            data.data.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store.name;
                opt.textContent = store.name;
                branchSelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error loading branches:', error);
    }
}

async function loadBranchBanks(branchName, selectedValue = null) {
    const field = document.getElementById('branchBank');
    if (!field) return;

    if (!branchName) {
        field.value = '';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/banks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            // Filter: Must be 'Branch Bank' type
            const branchBanks = data.data.filter(b => b.branch === branchName && b.isActive && b.bankType === 'Branch Bank');

            if (selectedValue) {
                field.value = selectedValue;
            } else if (branchBanks.length > 0) {
                // Only auto-select if field is currently empty
                if (!field.value) {
                    field.value = branchBanks[0].bankName;
                }
            }
        }
    } catch (error) {
        console.error('Error loading branch banks:', error);
    }
}

async function loadDepartments() {
    // Collect unique departments from allEmployees
    const depts = new Set();
    allEmployees.forEach(emp => {
        if (emp.department) {
            const deptName = typeof emp.department === 'object' ? emp.department.name : emp.department;
            if (deptName) depts.add(deptName);
        }
    });

    const deptSelect = document.getElementById('listDepartment');
    if (deptSelect) {
        deptSelect.innerHTML = '<option value="">Select Department</option>';
        Array.from(depts).sort().forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept;
            opt.textContent = dept;
            deptSelect.appendChild(opt);
        });
    }
}

let allEmployees = [];
let filteredEmployees = [];
let selectedSearchIndex = -1;

function GetTotalPresentEmployee() {
    const monthYear = $("#monthYear").val();
    const branch = $("#branch").val();

    if (!monthYear) {
        $("#totalPresentEmployees").text('0');
        return;
    }

    $.ajax({
        type: "get",
        dataType: "json",
        url: "/api/v1/payrolls",
        data: {
            monthYear: monthYear,
            branch: branch
        },
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        success: function (response) {
            if (response.success) {
                $("#totalPresentEmployees").text(response.count);
            } else {
                $("#totalPresentEmployees").text('0');
            }
        },
        error: function (err) {
            console.error('Error fetching present employees:', err);
            $("#totalPresentEmployees").text('0');
        }
    });
}


async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            allEmployees = data.data;
            initEmployeeSearch();
            loadDepartments();
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

function initEmployeeSearch() {
    const searchInput = document.getElementById('employeeSearch');
    const resultsDiv = document.getElementById('employeeSearchResults');

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();
        if (!term) {
            resultsDiv.style.display = 'none';
            filteredEmployees = [];
            selectedSearchIndex = -1;
            return;
        }

        filteredEmployees = allEmployees.filter(emp =>
            emp.name.toLowerCase().includes(term) ||
            (emp.code && String(emp.code).toLowerCase().includes(term))
        );

        selectedSearchIndex = -1;
        renderSearchResults(filteredEmployees);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (resultsDiv.style.display === 'none' || filteredEmployees.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSearchIndex = (selectedSearchIndex + 1) % filteredEmployees.length;
            updateActiveSearchItem();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSearchIndex = (selectedSearchIndex - 1 + filteredEmployees.length) % filteredEmployees.length;
            updateActiveSearchItem();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedSearchIndex >= 0) {
                selectEmployee(filteredEmployees[selectedSearchIndex]);
            }
        }
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value) {
            filteredEmployees = allEmployees.filter(emp =>
                emp.name.toLowerCase().includes(searchInput.value.toLowerCase())
            );
            selectedSearchIndex = -1;
            renderSearchResults(filteredEmployees);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            resultsDiv.style.display = 'none';
        }
    });
}

function updateActiveSearchItem() {
    const items = document.querySelectorAll('.search-item');
    items.forEach((item, index) => {
        if (index === selectedSearchIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function renderSearchResults(employees) {
    const resultsDiv = document.getElementById('employeeSearchResults');
    resultsDiv.innerHTML = '';

    if (employees.length === 0) {
        resultsDiv.style.display = 'none';
        return;
    }

    employees.forEach(emp => {
        const item = document.createElement('div');
        item.className = 'search-item';
        item.innerHTML = `<b>${emp.code || 'N/A'}</b> - ${emp.name}`;
        item.onclick = () => selectEmployee(emp);
        resultsDiv.appendChild(item);
    });

    resultsDiv.style.display = 'block';
}

async function selectEmployee(emp) {
    const searchInput = document.getElementById('employeeSearch');
    const resultsDiv = document.getElementById('employeeSearchResults');
    const hiddenInput = document.getElementById('employee');

    searchInput.value = emp.name;
    hiddenInput.value = emp._id;
    resultsDiv.style.display = 'none';
    document.getElementById('code').value = emp.code || '';
    // Initial Count Load
    GetTotalPresentEmployee();

    const monthYear = document.getElementById('monthYear').value;
    const branch = document.getElementById('branch').value;
    if (monthYear) {
        await loadOrCalculate(emp._id, monthYear, branch);
    }
}

async function findEmployeeByCode(code) {
    const employee = allEmployees.find(emp => String(emp.code) === String(code));
    if (employee) {
        selectEmployee(employee);
    } else {
        alert('Employee with this code not found.');
    }
}

async function loadOrCalculate(employeeId, monthYear, branch) {
    try {
        // Reset current ID and form values before loading new data
        currentPayrollId = null;

        // Ensure banks are loaded for this branch
        await loadBranchBanks(branch);

        const token = localStorage.getItem('token');
        // Search without branch filter to detect duplicates even if branch changed
        const checkRes = await fetch(`/api/v1/payrolls?employee=${employeeId}&monthYear=${monthYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const checkData = await checkRes.json();

        if (checkData.success && checkData.count > 0) {
            const payroll = checkData.data[0];
            currentPayrollId = payroll._id;
            populateForm(payroll);

            if (branch && payroll.branch !== branch) {
                alert(`Note: This employee already has a payroll record for this month in branch "${payroll.branch}". We have loaded that record.`);
                // Sync the branch dropdown to the existing record's branch
                const branchDropdown = document.getElementById('branch');
                if (branchDropdown) branchDropdown.value = payroll.branch;
            }
            // Removed redundant 'Existing payroll loaded' alert as requested
        } else {
            // No existing payroll, proceed with calculation
            const thirtyWorkingDays = document.getElementById('wkDays30').checked;

            const calcRes = await fetch('/api/v1/payrolls/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ employeeId, monthYear, branch, thirtyWorkingDays })
            });

            const calcData = await calcRes.json();
            if (calcData.success) {
                populateForm(calcData.data);
            }
        }
        calculateTotals();
    } catch (error) {
        console.error('Error processing payroll:', error);
        alert('An error occurred while loading payroll data. Please check connection and try again.');
    }
}

// Helper to format Decimal (81.7) to HH:MM (81:42)
function decimalToTime(decimal) {
    if (!decimal || isNaN(decimal)) return '0:00';
    const hrs = Math.floor(decimal);
    const mins = Math.round((decimal - hrs) * 60);
    return `${hrs}:${mins.toString().padStart(2, '0')}`;
}

// Helper to format HH:MM to Decimal
function timeToDecimal(str) {
    if (!str) return 0;
    const s = String(str).trim();
    if (s.includes(':')) {
        const [h, m] = s.split(':').map(Number);
        return (h || 0) + ((m || 0) / 60);
    }
    return parseFloat(s) || 0;
}

async function forceRecalculate(employeeId, monthYear, branch) {
    try {
        const token = localStorage.getItem('token');

        // Get checkbox states from UI
        const thirtyWorkingDays = document.getElementById('wkDays30').checked;

        const calcRes = await fetch('/api/v1/payrolls/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ employeeId, monthYear, branch, thirtyWorkingDays })
        });

        const calcData = await calcRes.json();
        if (calcData.success) {
            populateForm(calcData.data);
            calculateTotals();
        }
    } catch (error) {
        console.error('Error recalculating payroll:', error);
    }
}

function populateForm(data) {
    setValue('code', data.code);
    setValue('department', data.department?.name || data.department || 'N/A');
    setValue('designation', data.designation || 'N/A');
    setValue('bankName', data.bank || 'N/A');
    setValue('offDay', data.offDay || 'N/A');

    setValue('basicSalary', data.perMonth);
    setValue('totalDays', data.totalDays);
    setValue('totalWdsPerMonth', data.totalWdsPerMonth);
    setValue('totalHrsPerMonth', decimalToTime(data.totalHrsPerMonth || 0));
    setValue('workedDays', data.workedDays);

    // Header Checkboxes
    document.getElementById('wkDays30').checked = data.thirtyWorkingDays || false;
    document.getElementById('salThrBank').checked = data.payFullSalaryThroughBank || false;
    document.getElementById('payAdvSalary').checked = data.payAdvSalary || false;
    window.isOTST_ThirtyWorkingDays = data.otst30WorkingDays || false;
    window.fullStLessAllow = data.fullStLessAllow || 0;

    setValue('workedHrs', decimalToTime(data.workedHrs || 0));
    setValue('workedAmount', Math.round(data.workedAmount || 0));
    setValue('totalPerDay', parseFloat(data.totalPerDay || 0).toFixed(2));
    setValue('totalPerHr', parseFloat(data.totalPerHr || 0).toFixed(2));
    setValue('totalHrsPerDay', data.totalHrsPerDay || 8);
    setValue('perMonth', data.perMonth);

    window.baseShortHrs = parseFloat(data.shortTimeHrs || 0);
    setValue('overTimeHrs', decimalToTime(data.overTimeHrs || 0));
    setValue('overTimeAmount', parseFloat(data.overTime || 0).toFixed(2));
    setValue('shortTimeHrs', decimalToTime(window.baseShortHrs));
    setValue('shortTimeAmount', parseFloat(data.shortTimeAmount || 0).toFixed(2));
    setValue('tsw', parseFloat(data.shortWeek || 0).toFixed(2));
    if (document.getElementById('shortWeekDays')) {
        setValue('shortWeekDays', data.shortWeekDays || 0);
    }
    setValue('nashtaAmount', data.teaAllowance);
    setValue('nashtaDays', data.nashtaDays || 0);
    setValue('monthlyComm', data.monthlyComm);
    setValue('warehouseComm', data.warehouseComm);
    setValue('fixAllowance', data.natin);
    setValue('stLessAllow', data.stLateAllow);
    setValue('otherAllow', data.otherAllow);
    setValue('rotiAmount', data.rent);
    setValue('rotiDays', data.rotiDays || 0);

    setValue('tfc', data.fund);
    setValue('tfc', data.fund);
    setValue('foodDeduction', data.food || 0); // Food Rate
    setValue('securityDeposit', data.securityDeposit);
    setValue('penalty', data.penalty);

    setValue('ebDeduction', data.ebDeduction || 0); // Total EB Deduction
    setValue('umrahDeduction', 0);
    setValue('otherDeduction', 0);

    setValue('pmAdv', data.pAAdv);
    setValue('pmAdvRec', data.pmAdvRec || 0);
    setValue('cmAdv', data.csMale);
    setValue('cmAdvRec', data.cmAdvRec || 0);

    setValue('bankAmt', data.bankAmt);
    setValue('wht', data.wht);
    setValue('bankPaid', data.bankPaid);
    setValue('cashPaid', data.cashPaid);
    setValue('remarks', data.remarks);

    // Only overwrite branchBank if it exists in the data (for existing records)
    // Otherwise keep the auto-detected value from loadBranchBanks()
    if (data.branchBank) {
        setValue('branchBank', data.branchBank);
    }
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (!el) return;

    if (val === undefined || val === null) {
        el.value = (el.type === 'number') ? 0 : '';
    } else {
        el.value = val;
    }
}

function getValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    if (el.type === 'checkbox') return el.checked;

    const val = el.value || '';
    // If it's an hour based field, parse HH:MM
    const hourFields = ['workedHrs', 'overTimeHrs', 'shortTimeHrs', 'totalHrsPerMonth'];
    if (hourFields.includes(id)) {
        return timeToDecimal(val);
    }
    return (parseFloat(val) || 0);
}

function calculateTotals() {
    const basicInfo = getValue('basicSalary');
    const dutyHrs = getValue('totalHrsPerDay') || 8;
    const baseShortHrs = window.baseShortHrs || 0;
    const activeEl = document.activeElement ? document.activeElement.id : '';

    // Stamps Logic
    const payAdvSalary = document.getElementById('payAdvSalary').checked;
    const salThrBank = document.getElementById('salThrBank').checked;
    const wkDays30 = document.getElementById('wkDays30').checked;

    const stampContainer = document.getElementById('stampContainer');
    const bankStamp = document.getElementById('bankStamp');
    const paidStamp = document.getElementById('paidStamp');

    if (stampContainer && bankStamp && paidStamp) {
        if (payAdvSalary || salThrBank) {
            stampContainer.style.display = 'block';
            bankStamp.style.display = salThrBank ? 'block' : 'none';
            paidStamp.style.display = payAdvSalary ? 'block' : 'none';
        } else {
            stampContainer.style.display = 'none';
        }
    }

    // Formula: Salary Per Day = Basic / Total Working Days
    const wdsPerMonth = getValue('totalWdsPerMonth') || 30;
    const perDayAmt = basicInfo / wdsPerMonth;
    setValue('totalPerDay', perDayAmt.toFixed(2));

    // Formula: Salary Per Hour = Salary Per Day / Duty Hours
    const hourlyRate = perDayAmt / (dutyHrs || 8);
    setValue('totalPerHr', hourlyRate.toFixed(2));

    let workedHrs = getValue('workedHrs');
    const totalHrsReq = getValue('totalHrsPerMonth');
    let otHrs = getValue('overTimeHrs');

    // Rule: Excess Worked(Hrs) beyond TotalHrsPerMonth goes to OverTime
    if (workedHrs > totalHrsReq) {
        const excess = workedHrs - totalHrsReq;
        otHrs += excess;
        workedHrs = totalHrsReq;

        // Update UI fields if the user isn't currently typing in them
        if (activeEl !== 'workedHrs') setValue('workedHrs', decimalToTime(workedHrs));
        if (activeEl !== 'overTimeHrs') setValue('overTimeHrs', decimalToTime(otHrs));
    }

    // Formula: Salary Per Hour for OT and ST = Basic / 30 / Duty Hours
    const otstHourlyRate = basicInfo / 30 / (dutyHrs || 8);

    const otAmt = Math.round(otHrs * otstHourlyRate); // Rounded
    setValue('overTimeAmount', otAmt);

    // Dynamic ST.LessAllow calculation
    const fullSTAllow = window.fullStLessAllow || 0;
    const stDeduction = (fullSTAllow / 30 / (dutyHrs || 8)) * getValue('shortTimeHrs');
    const stAllow = Math.max(0, fullSTAllow - stDeduction);
    setValue('stLessAllow', Math.round(stAllow));

    const updatedEarnings = Math.round(
        otAmt +
        getValue('rotiAmount') +
        getValue('nashtaAmount') +
        getValue('monthlyComm') +
        getValue('warehouseComm') +
        getValue('fixAllowance') +
        getValue('stLessAllow') +
        getValue('otherAllow')
    );
    document.getElementById('earningsTotal').value = updatedEarnings;

    // Short Week Calculation: TSW = 4 - (TotalWorkedHrs / TotalHrsPerDay / 7)
    // IMPORTANT: use the original (possibly capped) workedHrs for consistency
    const weeksWorked = workedHrs / (dutyHrs || 8) / 7;
    const calculatedShortWeeks = Math.max(0, 4 - weeksWorked);

    const isShortWeek = getValue('checkShortWeek');
    let shortWeeks = getValue('shortWeekDays');
    let totalShortHrs = baseShortHrs;

    if (activeEl === 'shortWeekDays') {
        // User manually entered short week days
        totalShortHrs = baseShortHrs + (shortWeeks * dutyHrs);
        setValue('shortTimeHrs', decimalToTime(totalShortHrs));
    } else if (activeEl === 'shortTimeHrs') {
        // User manually entered short time hours
        totalShortHrs = getValue('shortTimeHrs');
        shortWeeks = (totalShortHrs - baseShortHrs) / (dutyHrs || 8);
        setValue('shortWeekDays', Math.round(shortWeeks));
    } else {
        if (isShortWeek) {
            // Auto-calculate using the formula
            shortWeeks = Math.round(calculatedShortWeeks);
            setValue('shortWeekDays', shortWeeks);
            totalShortHrs = baseShortHrs + (shortWeeks * dutyHrs);
            setValue('shortTimeHrs', decimalToTime(totalShortHrs));
        } else {
            totalShortHrs = baseShortHrs;
            setValue('shortTimeHrs', decimalToTime(totalShortHrs));
            setValue('shortWeekDays', 0);
        }
    }

    const shortAmt = Math.round(totalShortHrs * otstHourlyRate); // Rounded using standard 30-day rate
    setValue('shortTimeAmount', shortAmt);

    const foodRate = getValue('foodDeduction');
    const workedDaysForcalc = getValue('workedDays');
    const ebDeduction = Math.round(foodRate * workedDaysForcalc);
    setValue('ebDeduction', ebDeduction);

    const deductions = Math.round(
        shortAmt +
        getValue('tfc') +
        getValue('ebDeduction') + // Use EB deduction as the actual food cost
        getValue('umrahDeduction') +
        getValue('otherDeduction') +
        getValue('securityDeposit') +
        getValue('penalty')
    );

    document.getElementById('deductionsTotal').value = deductions;

    // Use the workedHrs already declared above
    const workedAmount = Math.round(workedHrs * hourlyRate);
    setValue('workedAmount', workedAmount);

    // Gross Total = Basic Salary + Earnings - Deductions Total (CONSISTENT FORMULA)
    const grossTotal = Math.round(basicInfo + updatedEarnings - deductions);
    document.getElementById('grossTotal').value = grossTotal;

    const advancesRec = Math.round(getValue('cmAdvRec') + getValue('pmAdvRec'));
    document.getElementById('totalAdv').value = advancesRec;

    // Net Total = Gross Total - Advances Recovered (deductions already subtracted in Gross)
    const netTotal = Math.round(grossTotal - advancesRec);
    document.getElementById('netTotal').value = netTotal;

    // --- WHT (Income Tax) Calculation 2025-2026 ---
    let wht = 0;
    if (salThrBank) {
        const annualSalary = netTotal * 12;
        let annualTax = 0;

        if (annualSalary <= 600000) {
            annualTax = 0;
        } else if (annualSalary <= 1200000) {
            annualTax = (annualSalary - 600000) * 0.01;
        } else if (annualSalary <= 2200000) {
            annualTax = 6000 + (annualSalary - 1200000) * 0.11;
        } else if (annualSalary <= 3200000) {
            annualTax = 116000 + (annualSalary - 2200000) * 0.23;
        } else if (annualSalary <= 4100000) {
            annualTax = 346000 + (annualSalary - 3200000) * 0.30;
        } else {
            annualTax = 616000 + (annualSalary - 4100000) * 0.35;
        }

        // Apply 9% surcharge if annual taxable income exceeds 10 Million
        if (annualSalary > 10000000) {
            annualTax += (annualTax * 0.09);
        }

        wht = Math.round(annualTax / 12);
    }

    setValue('wht', wht);
    const finalAmount = Math.round(netTotal - wht);

    if (salThrBank) {
        setValue('bankPaid', finalAmount);
        setValue('cashPaid', 0);
    } else {
        setValue('cashPaid', finalAmount);
        setValue('bankPaid', 0);
    }

    const totalPaid = getValue('bankPaid') + getValue('cashPaid');
    const balance = Math.round(netTotal - totalPaid - wht); // Deduct wht to get accurate balance
    document.getElementById('balance').value = balance;
}




async function savePayroll() {
    if (currentPayrollId) {
        alert("Payroll already exists for this employee and month. To update or make changes, please delete the existing record from the list first and then save again.");
        return;
    }

    const data = {
        employee: document.getElementById('employee').value,
        monthYear: document.getElementById('monthYear').value,
        branch: document.getElementById('branch').value,
        code: document.getElementById('code').value,
        bank: document.getElementById('bankName').value,
        department: document.getElementById('department').value,
        designation: document.getElementById('designation').value,
        totalDays: getValue('totalDays'),
        totalWdsPerMonth: getValue('totalWdsPerMonth'),
        totalWdsPerMonthHrs: getValue('totalHrsPerMonth'),
        totalHrsPerMonth: getValue('totalHrsPerMonth'),
        totalHrsPerDay: getValue('totalHrsPerDay'),
        perMonth: getValue('basicSalary'),
        offDay: getValue('offDay'),
        totalPerDay: getValue('totalPerDay'),
        totalPerHr: getValue('totalPerHr'),
        salaryPer: getValue('salaryPer'),
        workedHrs: timeToDecimal(document.getElementById('workedHrs').value),
        workedDays: getValue('workedDays'),
        overTime: getValue('overTimeAmount'),
        rent: getValue('rotiAmount'),
        natin: getValue('fixAllowance'),
        monthlyComm: getValue('monthlyComm'),
        warehouseComm: getValue('warehouseComm'),
        teaAllowance: getValue('nashtaAmount'),
        nashtaDays: getValue('nashtaDays'),
        stLateAllow: getValue('stLessAllow'),
        otherAllow: getValue('otherAllow'),
        rotiDays: getValue('rotiDays'),
        earningsTotal: getValue('earningsTotal'),
        overTimeHrs: timeToDecimal(document.getElementById('overTimeHrs').value),
        shortWeek: getValue('shortTimeAmount'),
        ttw: getValue('tsw'),
        fund: getValue('tfc'),
        food: getValue('foodDeduction'), // Rate
        ebDeduction: getValue('ebDeduction'), // Total
        ugrm: 0, // Legacy field
        securityDeposit: getValue('securityDeposit'),
        penalty: getValue('penalty'),
        deductionsTotal: getValue('deductionsTotal'),
        grossTotal: getValue('grossTotal'),
        csMale: getValue('cmAdv'),
        pAAdv: getValue('pmAdv'),
        totalAdv: getValue('totalAdv'),
        netTotal: getValue('netTotal'),
        bankAmt: getValue('bankAmt'),
        wht: getValue('wht'),
        bankPaid: getValue('bankPaid'),
        cashPaid: getValue('cashPaid'),
        rebate: getValue('balance'),
        remarks: document.getElementById('remarks').value,
        branchBank: document.getElementById('branchBank').value,

        // Add back decimal values for hours
        shortTimeHrs: timeToDecimal(document.getElementById('shortTimeHrs').value),

        // Flags
        payAdvSalary: document.getElementById('payAdvSalary').checked,
        thirtyWorkingDays: document.getElementById('wkDays30').checked,
        payFullSalaryThroughBank: document.getElementById('salThrBank').checked
    };

    // Validation: Basic Salary and Worked Hours must be > 0
    if (!data.perMonth || data.perMonth <= 0) {
        alert("Employee Basic Salary cannot be zero.");
        return;
    }
    if (!data.workedHrs || data.workedHrs <= 0) {
        alert("Employee Worked(Hrs) cannot be zero.");
        return;
    }

    // Trim values for comparison
    const empBank = data.bank ? data.bank.trim() : '';
    const brBank = data.branchBank ? data.branchBank.trim() : '';

    // Validation: If Employee has a bank, Branch Bank MUST be selected
    if (empBank && !brBank) {
        alert("Please select a Branch Bank to proceed.");
        return;
    }

    // Bank Mismatch Check
    if (brBank && empBank && brBank !== empBank) {
        const confirmMsg = `Employee Bank (${empBank}) and Branch Bank (${brBank}) are different.\nDo you want to continue?`;
        if (!confirm(confirmMsg)) {
            return;
        }
        // Force Full Bank Paid flag
        data.payFullSalaryThroughBank = true;
    }

    try {
        const token = localStorage.getItem('token');
        const url = currentPayrollId ? `/api/v1/payrolls/${currentPayrollId}` : '/api/v1/payrolls';
        const method = currentPayrollId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            alert(currentPayrollId ? 'Payroll updated successfully!' : 'Payroll saved successfully!');
            resetForm();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving payroll:', error);
        alert('Error saving payroll');
    }
}

function resetForm() {
    currentPayrollId = null;
    window.baseShortHrs = 0;

    // Clear Search Inputs
    document.getElementById('employeeSearch').value = '';
    document.getElementById('employee').value = '';
    document.getElementById('code').value = '';

    // Clear all numeric and text fields using a list of IDs
    const fieldsToClear = [
        'department', 'designation', 'bankName', 'offDay', 'basicSalary',
        'totalDays', 'totalWdsPerMonth', 'totalHrsPerMonth', 'workedDays',
        'workedHrs', 'totalPerDay', 'totalPerHr', 'totalHrsPerDay', 'perMonth',
        'overTimeHrs', 'overTimeAmount', 'shortTimeHrs', 'shortTimeAmount',
        'tsw', 'shortWeekDays', 'nashtaAmount', 'monthlyComm', 'warehouseComm', 'fixAllowance',
        'stLessAllow', 'otherAllow', 'rotiAmount', 'tfc', 'foodDeduction',
        'securityDeposit', 'penalty', 'ebDeduction', 'umrahDeduction',
        'otherDeduction', 'pmAdv', 'pmAdvRec', 'cmAdv', 'cmAdvRec',
        'bankAmt', 'wht', 'bankPaid', 'cashPaid', 'remarks', 'branchBank',
        'earningsTotal', 'deductionsTotal', 'grossTotal', 'netTotal', 'totalAdv', 'balance'
    ];

    fieldsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'SELECT') el.selectedIndex = 0;
            else el.value = '';
        }
    });

    const checkShortWeek = document.getElementById('checkShortWeek');
    if (checkShortWeek) checkShortWeek.checked = false;

    document.getElementById('payAdvSalary').checked = false;
    document.getElementById('wkDays30').checked = false;
    document.getElementById('salThrBank').checked = false;

    const stampContainer = document.getElementById('stampContainer');
    if (stampContainer) stampContainer.style.display = 'none';

    // Focus back on code for next entry
    document.getElementById('code').focus();
}

function showList() {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('payrollListModal'));
    modal.show();

    // Sync Month-Year
    const monthYear = document.getElementById('monthYear').value;
    document.getElementById('listMonthYear').value = monthYear;

    // Sync Branch and load filters
    loadListFilters();
    const mainBranchValue = document.getElementById('branch').value;
    const listBranch = document.getElementById('listBranch');

    // Ensure the branch value exists in the copied options
    if (mainBranchValue) {
        listBranch.value = mainBranchValue;
    }

    loadPayrollList();
}


function loadListFilters() {
    const listBranch = document.getElementById('listBranch');
    const mainBranch = document.getElementById('branch').innerHTML;
    listBranch.innerHTML = mainBranch; // Already has Select Branch

    // Departments are already loaded in DOMContentLoaded via loadDepartments()
}

async function loadPayrollList() {
    try {
        const token = localStorage.getItem('token');
        const monthYear = document.getElementById('listMonthYear').value;
        const branch = document.getElementById('listBranch').value;
        const dept = document.getElementById('listDepartment').value;
        const empType = document.getElementById('listEmployeeType').value;

        let query = `?monthYear=${encodeURIComponent(monthYear)}`;
        // Only add branch to query if it's a real value (not empty or default)
        if (branch && branch !== 'Select Branch' && branch !== '') {
            query += `&branch=${encodeURIComponent(branch)}`;
        }



        const response = await fetch(`/api/v1/payrolls${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            let payrolls = data.data;

            // Filter by Department
            if (dept) {
                payrolls = payrolls.filter(p => (p.department?.name || p.department) === dept);
            }

            // Filter by Emp Type
            if (empType !== 'all') {
                payrolls = payrolls.filter(p => {
                    if (empType === 'payAdvance') return (p.pAAdv > 0 || p.csMale > 0);
                    if (empType === 'commission') return (p.monthlyComm > 0);
                    if (empType === 'bank') return (p.bankPaid > 0);
                    if (empType === 'cashPaid') return (p.cashPaid > 0);
                    return true;
                });
            }

            currentListPayrolls = payrolls;
            renderPayrollTable(payrolls);
        }
    } catch (error) {
        console.error('Error loading payroll list:', error);
    }
}

function renderPayrollTable(payrolls) {
    const searchText = document.getElementById('listSearchText').value.toLowerCase();
    const tbody = document.getElementById('payrollTableBody');
    tbody.innerHTML = '';

    const filtered = payrolls.filter(p =>
        (p.employee?.name || '').toLowerCase().includes(searchText) ||
        (p.code || '').toLowerCase().includes(searchText)
    );

    // Reset Select All checkbox
    const selectAllCheck = document.getElementById('selectAllPayrolls');
    if (selectAllCheck) selectAllCheck.checked = false;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const rights = user.rights || {};
    const permissions = user.permissions || [];
    // Strictly link deletion to "Allow PayRoll Delete" (mod_11)
    const canDelete = rights['mod_11'] || permissions.includes('mod_11');

    filtered.forEach((p, index) => {
        const row = document.createElement('tr');
        let rowClass = '';
        if (p.payAdvSalary) {
            rowClass = 'row-advance';
        } else if (p.bankPaid > 0 || p.cashPaid > 0) {
            rowClass = 'row-paid';
        }
        row.className = rowClass;
        const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A';
        const allowances = (p.rent || 0) + (p.teaAllowance || 0) + (p.natin || 0) + (p.stLateAllow || 0) + (p.otherAllow || 0) + (p.monthlyComm || 0);
        const deductions = (p.shortWeek || 0) + (p.ttw || 0) + (p.fund || 0) + (p.ugrm || 0) + (p.penalty || 0) + (p.securityDeposit || 0);

        row.innerHTML = `
            <td><input type="checkbox" class="payroll-checkbox" value="${p._id}"></td>
            <td class="text-center">
                <button class="btn btn-sm btn-primary py-0 px-1" onclick="printPayroll('${p._id}')">Print</button>
                ${canDelete ? `<button class="btn btn-sm btn-danger py-0 px-1" onclick="deletePayroll('${p._id}')">Delete</button>` : ''}
            </td>
            <td>${p._id.substring(p._id.length - 5)}</td>
            <td>${p.code || ''}</td>
            <td>${date}</td>
            <td>${p.employee?.name || 'N/A'}</td>
            <td>${p.department?.name || p.department || ''}</td>
            <td>${p.designation || ''}</td>
            <td>${p.branch || ''}</td>
            <td>${(p.perMonth || 0).toLocaleString()}</td>
            <td>${(p.overTime || 0).toLocaleString()}</td>
            <td>${allowances.toLocaleString()}</td>
            <td>${(p.grossTotal || 0).toLocaleString()}</td>
            <td>${deductions.toLocaleString()}</td>
            <td>${(p.totalAdv || 0).toLocaleString()}</td>
            <td>${(p.wht || 0).toLocaleString()}</td>
            <td>${(p.netTotal || 0).toLocaleString()}</td>
        `;
        tbody.appendChild(row);
    });
}

function printSelected() {
    const checkboxes = document.querySelectorAll('.payroll-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);
    if (ids.length === 0) {
        alert('Please select at least one payroll to print.');
        return;
    }
    window.open(`/print-payroll.html?ids=${ids.join(',')}`, '_blank');
}

function printAll() {
    if (currentListPayrolls.length === 0) {
        alert('No payrolls in the current list to print.');
        return;
    }
    const ids = currentListPayrolls.map(p => p._id);
    window.open(`/print-payroll.html?ids=${ids.join(',')}`, '_blank');
}

async function deletePayroll(id) {
    pendingDeleteId = id;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('authUser').value = user.name || 'User';
    document.getElementById('authPassword').value = '';

    const modal = new bootstrap.Modal(document.getElementById('authModal'));
    modal.show();

    // Focus password field
    document.getElementById('authModal').addEventListener('shown.bs.modal', () => {
        document.getElementById('authPassword').focus();
    }, { once: true });
}

async function confirmDelete() {
    const password = document.getElementById('authPassword').value;
    if (!password) {
        alert('Please enter your password');
        return;
    }

    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const token = localStorage.getItem('token');

        // Verify Password via Login API
        const verifyRes = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: password })
        });

        const verifyData = await verifyRes.json();

        // Check for token or ok status since the login API doesn't return a 'success' flag
        if (!verifyRes.ok || !verifyData.token) {
            alert('Invalid Password');
            return;
        }

        // Final permission check after verify password
        const currentUser = verifyData.user || user;
        const currentRights = currentUser.rights || {};
        const currentPerms = currentUser.permissions || [];
        // Strictly use "Allow PayRoll Delete" (mod_11)
        const hasRight = currentRights['mod_11'] || currentPerms.includes('mod_11');

        if (!hasRight) {
            alert('Access Denied: You do not have PayRoll Delete rights.');
            return;
        }

        // Proceed with deletion
        const response = await fetch(`/api/v1/payrolls/${pendingDeleteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success) {
            // Hide modal
            const modalEl = document.getElementById('authModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            alert('Payroll deleted successfully');

            // If we deleted the payroll that is currently loaded, reset the form
            if (pendingDeleteId === currentPayrollId) {
                resetForm();
            }

            loadPayrollList();
            GetTotalPresentEmployee(); // Update count
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting payroll:', error);
        alert('An error occurred during deletion');
    }
}

function printPayroll(id) {
    window.open(`/print-payroll.html?id=${id}`, '_blank');
}
