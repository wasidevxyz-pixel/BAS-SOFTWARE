const Employee = require('../models/Employee');
const EmployeeDepartment = require('../models/EmployeeDepartment');
const Payroll = require('../models/Payroll');
const EmployeeCommission = require('../models/EmployeeCommission');

// @desc    Get Employee Salary Detail Report
// @route   GET /api/v1/employee-salary-detail/report
exports.getSalaryDetailReport = async (req, res) => {
    try {
        const { branch, department, designation, type, employeeId, code } = req.query;

        let query = { isActive: true };
        if (employeeId && employeeId !== '') query._id = employeeId;
        if (code && code !== '') query.code = { $regex: code, $options: 'i' };
        if (branch && branch !== 'All Branches') query.branch = branch;
        if (department && department !== 'All Departments' && department !== '') query.department = department;
        if (designation && designation !== 'All Designations' && designation !== '') query.designation = designation;

        if (type && type !== 'all') {
            if (type === 'commission') query.commEmp = true;
            // User Request: If payFullSalaryThroughBank is active, show in bank, otherwise cash.
            if (type === 'bank') query.payFullSalaryThroughBank = true;
            if (type === 'cash') query.payFullSalaryThroughBank = { $ne: true };
            if (type === 'zero_salary') {
                query.$or = [{ basicSalary: 0 }, { basicSalary: { $exists: false } }];
            }
        }

        const employees = await Employee.find(query)
            .populate('department', 'name')
            .populate('designation', 'name')
            .sort({ code: 1 });

        const reportData = employees.map(emp => {
            const basicSalary = emp.basicSalary || 0;
            const otherAllowance = emp.otherAllowance || 0;
            const stLoss = emp.stLoss || 0;
            const fixAllowance = emp.fixAllowance || 0;
            const netSalary = basicSalary + otherAllowance + fixAllowance - stLoss;

            return {
                _id: emp._id,
                code: emp.code,
                name: emp.name,
                department: emp.department ? emp.department.name : 'Unknown',
                designation: emp.designation ? emp.designation.name : 'N/A',
                incrDate: emp.incrDate,
                basicSalary,
                otherAllowance,
                stLoss,
                fixAllowance,
                netSalary,
                bankCash: emp.bankCash
            };
        });

        // Group by department
        const groupedData = reportData.reduce((acc, curr) => {
            const dept = curr.department;
            if (!acc[dept]) acc[dept] = { employees: [], totalBasic: 0, totalNet: 0 };
            acc[dept].employees.push(curr);
            acc[dept].totalBasic += curr.basicSalary;
            acc[dept].totalNet += curr.netSalary;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: groupedData
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
