const mongoose = require('mongoose');
const Employee = require('./Backend/models/Employee');
const Attendance = require('./Backend/models/Attendance');
const EmployeeDepartment = require('./Backend/models/EmployeeDepartment');
const dotenv = require('dotenv');

dotenv.config({ path: './Backend/.env' });

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/BAS-SOFTWARE');
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const debugEmployee = async () => {
    await connectDB();

    const empCode = '3000'; // MR WASI
    const targetDateStr = '2026-02-04';

    const employee = await Employee.findOne({ code: empCode }).populate('department');
    if (!employee) {
        console.log('Employee not found');
        process.exit();
    }

    console.log(`Employee: ${employee.name}`);
    console.log(`Department: ${employee.department ? employee.department.name : 'None'}`);
    console.log(`Max Checkout: ${employee.department ? employee.department.maxCheckoutTime : 'Default'}`);

    const startDate = new Date(targetDateStr);
    const endDate = new Date(targetDateStr);
    endDate.setDate(endDate.getDate() + 1);

    const attendance = await Attendance.findOne({
        employee: employee._id,
        date: { $gte: startDate, $lt: endDate }
    });

    if (attendance) {
        console.log('Attendance Record Found:');
        console.log(JSON.stringify(attendance, null, 2));
    } else {
        console.log('No attendance record found for date:', targetDateStr);
    }

    process.exit();
};

debugEmployee();
