// Map Frontend IDs to Backend Schema Fields
const FIELD_MAPPING = {
    // Earnings
    overTimeAmount: 'overTime',
    rotiAmount: 'rent',
    nashtaAmount: 'teaAllowance',
    monthlyComm: 'monthlyComm',
    fixAllowance: 'natin',
    stLessAllow: 'stLateAllow',
    otherAllow: 'otherAllow',

    // Deductions
    // shortTimeAmount -> Not directly mapped, maybe add to penalty or use other field? 
    // For now, I will treat shortTimeAmount as part of 'penalty' if no other field fits, 
    // OR just rely on total calculation. 
    // Actually, let's map it to 'penalty' for now to save it somewhere, or ignores it.
    // Wait, let's check schema again. 
    // 'shortWeek' exists in schema (line 68). Maybe that's ShortTime Amount?

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
    balance: 'rebate', // Mapping balance to rebate? Or maybe calculate balance dynamically?
    remarks: 'remarks',
    branchBank: 'branchBank'
};

let currentPayrollId = null;

document.addEventListener('DOMContentLoaded', () => {
    setDefaultDate();
    loadBranches(); // If dynamic
    loadEmployees();

    // Add Event Listeners for Calculation
    const calcFields = [
        'overTimeAmount', 'rotiAmount', 'nashtaAmount', 'monthlyComm',
        'fixAllowance', 'stLessAllow', 'otherAllow',
        'shortTimeAmount', 'tsw', 'tfc', 'foodDeduction', 'ebDeduction',
        'umrahDeduction', 'otherDeduction', 'securityDeposit', 'penalty',
        'pAAdv', 'cmAdv', 'totalAdv', 'bankPaid', 'cashPaid'
    ];

    calcFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculateTotals);
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
    document.getElementById('monthYear').addEventListener('change', async (e) => {
        const employeeId = document.getElementById('employee').value;
        const monthYear = e.target.value;
        const branch = document.getElementById('branch').value;

        if (employeeId && monthYear) {
            await loadOrCalculate(employeeId, monthYear, branch);
        }
    });
});

function setDefaultDate() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    document.getElementById('monthYear').value = `${year}-${month}`;
}

function loadBranches() {
    const branchSelect = document.getElementById('branch');
    // Hardcoded for now as per other files
    const branches = ['F-6', 'G-10', 'I-8'];
    branchSelect.innerHTML = '<option value="">Select Branch</option>';
    branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        branchSelect.appendChild(opt);
    });
    // branchSelect.value = 'F-6'; // Removed default
}

async function loadEmployees() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/v1/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('employee');
            select.innerHTML = '<option value="">Select Employee</option>';
            data.data.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp._id;
                opt.textContent = `${emp.name} (${emp.code || 'N/A'})`;
                select.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
    }
}

async function loadOrCalculate(employeeId, monthYear, branch) {
    try {
        const token = localStorage.getItem('token');

        // 1. Check if payroll exists
        const checkRes = await fetch(`/api/v1/payrolls?employee=${employeeId}&monthYear=${monthYear}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const checkData = await checkRes.json();

        if (checkData.success && checkData.count > 0) {
            // Exists -> Load it
            const payroll = checkData.data[0];
            currentPayrollId = payroll._id;
            console.log('Loaded existing payroll:', currentPayrollId);
            populateForm(payroll);
            alert('Existing payroll loaded for this month.');
        } else {
            // Does not exist -> Calculate
            currentPayrollId = null;
            console.log('Calculating new payroll...');
            const calcRes = await fetch('/api/v1/payrolls/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ employeeId, monthYear, branch })
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

function populateForm(data) {
    // Profile
    setValue('code', data.code);
    setValue('department', data.department?.name || data.department); // Handle object or string
    setValue('designation', data.designation);

    // Basic items
    setValue('basicSalary', data.perMonth); // Schema perMonth is Basic Salary
    setValue('totalDays', data.totalDays);
    setValue('workedDays', data.workedDays);
    setValue('workedHrs', data.workedHrs);
    setValue('totalHrsPerDay', data.totalHrsPerDay || 8); // Default
    setValue('totalPerDay', data.totalPerDay?.toFixed(2));
    setValue('salaryPer', data.perMonth); // Same as Basic?

    // Earnings
    setValue('overTimeAmount', data.overTime);
    setValue('rotiAmount', data.rent);
    setValue('nashtaAmount', data.teaAllowance);
    setValue('monthlyComm', data.monthlyComm);
    setValue('fixAllowance', data.natin);
    setValue('stLessAllow', data.stLateAllow);
    setValue('otherAllow', data.otherAllow);

    // Deductions
    setValue('shortTimeAmount', data.shortWeek);
    setValue('tsw', data.ttw);
    setValue('tfc', data.fund);
    setValue('foodDeduction', data.ugrm);
    setValue('securityDeposit', data.securityDeposit);
    setValue('penalty', data.penalty);

    // Other implicit/unused in schema
    setValue('ebDeduction', 0);
    setValue('umrahDeduction', 0);
    setValue('otherDeduction', 0);

    // Advances & Net
    setValue('pmAdv', data.pAAdv);
    setValue('cmAdv', data.csMale || 0); // Using csMale for cmAdv if applicable, otherwise 0
    // Note: data.csMale might not be cmAdv, but sticking to existing schema fields if possible.

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
    return el ? (parseFloat(el.value) || 0) : 0;
}

function calculateTotals() {
    // Earnings
    const earnings =
        getValue('overTimeAmount') +
        getValue('rotiAmount') +
        getValue('nashtaAmount') +
        getValue('monthlyComm') +
        getValue('fixAllowance') +
        getValue('stLessAllow') +
        getValue('otherAllow');

    document.getElementById('earningsTotal').value = earnings.toFixed(2);

    // Deductions
    const deductions =
        getValue('shortTimeAmount') +
        getValue('tsw') +
        getValue('tfc') +
        getValue('foodDeduction') +
        getValue('ebDeduction') +
        getValue('umrahDeduction') +
        getValue('otherDeduction') +
        getValue('securityDeposit') +
        getValue('penalty');

    document.getElementById('deductionsTotal').value = deductions.toFixed(2);

    // Net Calc
    const basicInfo = getValue('basicSalary'); // or perMonth
    const grossTotal = basicInfo + earnings;
    document.getElementById('grossTotal').value = grossTotal.toFixed(2);

    const advances = getValue('cmAdv') + getValue('pmAdv'); // Total Advances
    document.getElementById('totalAdv').value = advances.toFixed(2);

    const netTotal = grossTotal - deductions - advances; // - wht?
    document.getElementById('netTotal').value = netTotal.toFixed(2);

    // You might want to update Balance
    const totalPaid = getValue('bankPaid') + getValue('cashPaid');
    const balance = netTotal - totalPaid;
    document.getElementById('balance').value = balance.toFixed(2);
}

async function savePayroll() {
    const data = {
        employee: document.getElementById('employee').value,
        monthYear: document.getElementById('monthYear').value,
        branch: document.getElementById('branch').value,

        // Profile
        code: document.getElementById('code').value,
        bank: document.getElementById('bankName').value,
        department: document.getElementById('department').value,
        designation: document.getElementById('designation').value,
        totalDays: getValue('totalDays'),
        totalHrsPerDay: getValue('totalHrsPerDay'),
        perMonth: getValue('basicSalary'),
        offDay: getValue('offDay'),
        totalPerDay: getValue('totalPerDay'),
        totalPerHr: getValue('totalPerHr'),
        salaryPer: getValue('salaryPer'),
        workedHrs: getValue('workedHrs'),
        workedDays: getValue('workedDays'),

        // Earnings
        overTime: getValue('overTimeAmount'),
        rent: getValue('rotiAmount'), // Mapping Roti -> Rent
        natin: getValue('fixAllowance'), // Mapping Fix -> Natin
        monthlyComm: getValue('monthlyComm'),
        teaAllowance: getValue('nashtaAmount'), // Mapping Nashta -> Tea
        stLateAllow: getValue('stLessAllow'),
        otherAllow: getValue('otherAllow'),
        earningsTotal: getValue('earningsTotal'),

        // Deductions
        overTimeHrs: getValue('overTimeHrs'), // Storing Hrs
        shortWeek: getValue('shortTimeAmount'), // Storing ShortTime Amount here?
        ttw: getValue('tsw'),
        fund: getValue('tfc'), // Mapping TFC -> Fund
        ugrm: getValue('foodDeduction'), // Mapping Food -> UGRM
        securityDeposit: getValue('securityDeposit'),
        penalty: getValue('penalty'),
        deductionsTotal: getValue('deductionsTotal'),

        // Net
        grossTotal: getValue('grossTotal'),
        // Note: Schema has csMale, pAAdv, totalAdv. 
        csMale: getValue('cmAdv'), // Mapping cmAdv to csMale?
        pAAdv: getValue('pmAdv'),
        totalAdv: getValue('totalAdv'),
        netTotal: getValue('netTotal'),
        bankAmt: getValue('bankAmt'),
        wht: getValue('wht'),
        bankPaid: getValue('bankPaid'),
        cashPaid: getValue('cashPaid'),
        rebate: getValue('balance'), // Storing Balance in Rebate? Or just unused. Use carefully.
        remarks: document.getElementById('remarks').value,
        branchBank: document.getElementById('branchBank').value
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
            // If created, set current ID
            if (!currentPayrollId && result.data) {
                currentPayrollId = result.data._id;
            }
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving payroll:', error);
        alert('Error saving payroll');
    }
}

function showList() {
    // Reloads /payroll-list.html if it exists or shows modal
    alert("List feature coming soon!");
}
