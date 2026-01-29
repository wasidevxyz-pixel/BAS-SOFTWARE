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

document.addEventListener('DOMContentLoaded', () => {
    initializeHeaderUser();
    setDefaultDate();
    loadBranches();
    loadEmployees();

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

        if (employeeId && monthYear) {
            await loadOrCalculate(employeeId, monthYear, branch);
        }
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

    // Global Shortcut Keys
    document.addEventListener('keydown', (e) => {
        // Alt + S to Save
        if (e.altKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            savePayroll();
        }
        // Alt + L to Show List
        if (e.altKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            showList();
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
        const token = localStorage.getItem('token');
        const checkRes = await fetch(`/api/v1/payrolls?employee=${employeeId}&monthYear=${monthYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const checkData = await checkRes.json();

        if (checkData.success && checkData.count > 0) {
            const payroll = checkData.data[0];
            currentPayrollId = payroll._id;
            populateForm(payroll);
            alert('Existing payroll loaded for this month.');
        } else {
            currentPayrollId = null;

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
            }
        }
        calculateTotals();
    } catch (error) {
        console.error('Error processing payroll:', error);
    }
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
    setValue('totalHrsPerMonth', parseFloat(data.totalHrsPerMonth || 0).toFixed(2));
    setValue('workedDays', data.workedDays);

    // Header Checkboxes
    document.getElementById('wkDays30').checked = data.thirtyWorkingDays || false;
    document.getElementById('salThrBank').checked = data.payFullSalaryThroughBank || false;
    document.getElementById('payAdvSalary').checked = data.payAdvSalary || false;
    window.isOTST_ThirtyWorkingDays = data.otst30WorkingDays || false;
    window.fullStLessAllow = data.fullStLessAllow || 0;

    setValue('workedHrs', parseFloat(data.workedHrs || 0).toFixed(2));
    setValue('workedAmount', Math.round(data.workedAmount || 0));
    setValue('totalPerDay', parseFloat(data.totalPerDay || 0).toFixed(2));
    setValue('totalPerHr', parseFloat(data.totalPerHr || 0).toFixed(2));
    setValue('totalHrsPerDay', data.totalHrsPerDay || 8);
    setValue('perMonth', data.perMonth);

    window.baseShortHrs = parseFloat(data.shortTimeHrs || 0);
    setValue('overTimeHrs', parseFloat(data.overTimeHrs || 0).toFixed(2));
    setValue('overTimeAmount', parseFloat(data.overTime || 0).toFixed(2));
    setValue('shortTimeHrs', window.baseShortHrs.toFixed(2));
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
    setValue('branchBank', data.branchBank);
}

function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined ? val : 0;
}

function getValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    if (el.type === 'checkbox') return el.checked;
    return (parseFloat(el.value) || 0);
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

    let hourlyRate = getValue('totalPerDay') / (dutyHrs || 8);

    // If OTST_ThirtyWorkingDays is active, always use (Basic / 30 / DutyHrs)
    if (window.isOTST_ThirtyWorkingDays) {
        hourlyRate = (basicInfo / 30) / (dutyHrs || 8);
    } else if (wkDays30) {
        // Fallback to Thirty Working Days flag if OTST is not specifically set
        hourlyRate = (basicInfo / 30) / (dutyHrs || 8);
    }

    const otHrs = getValue('overTimeHrs');
    const otAmt = Math.round(otHrs * hourlyRate); // Rounded
    setValue('overTimeAmount', otAmt);

    // Dynamic ST.LessAllow calculation
    const workedHrs = getValue('workedHrs');
    const totalHrsReq = getValue('totalHrsPerMonth');
    const fullSTAllow = window.fullStLessAllow || 0;
    let stAllow = fullSTAllow;

    if (workedHrs < totalHrsReq) {
        // (Full Allowance / 30 / DutyHours) * WorkedHours
        stAllow = (fullSTAllow / 30 / (dutyHrs || 8)) * workedHrs;
    }
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

    // Get worked hours for short week calculation
    // workedHrs already declared above

    // Short Week Calculation: TSW = 4 - (TotalWorkedHrs / TotalHrsPerDay / 7)
    const weeksWorked = workedHrs / (dutyHrs || 8) / 7;
    const calculatedShortWeeks = Math.max(0, 4 - weeksWorked);

    const isShortWeek = getValue('checkShortWeek');
    let shortWeeks = getValue('shortWeekDays');
    let totalShortHrs = baseShortHrs;

    if (activeEl === 'shortWeekDays') {
        // User manually entered short week days
        totalShortHrs = baseShortHrs + (shortWeeks * dutyHrs);
        setValue('shortTimeHrs', totalShortHrs.toFixed(2));
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
            setValue('shortTimeHrs', totalShortHrs.toFixed(2));
        } else {
            totalShortHrs = baseShortHrs;
            setValue('shortTimeHrs', totalShortHrs.toFixed(2));
            setValue('shortWeekDays', 0);
        }
    }

    const shortAmt = Math.round(totalShortHrs * hourlyRate); // Rounded
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
        workedHrs: getValue('workedHrs'),
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
        overTimeHrs: getValue('overTimeHrs'),
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

        // Flags
        payAdvSalary: document.getElementById('payAdvSalary').checked,
        thirtyWorkingDays: document.getElementById('wkDays30').checked,
        payFullSalaryThroughBank: document.getElementById('salThrBank').checked
    };

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
    const modal = new bootstrap.Modal(document.getElementById('payrollListModal'));
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
                <button class="btn btn-sm btn-danger py-0 px-1" onclick="deletePayroll('${p._id}')">Delete</button>
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
    if (!confirm('Are you sure you want to delete this payroll?')) return;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/v1/payrolls/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
            alert('Payroll deleted successfully');
            loadPayrollList();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting payroll:', error);
    }
}

function printPayroll(id) {
    window.open(`/print-payroll.html?id=${id}`, '_blank');
}
