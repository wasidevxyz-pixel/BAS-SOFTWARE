const ClosingSheet = require('../models/ClosingSheet');
const SalesReturn = require('../models/SalesReturn');
const Expense = require('../models/Expense');
const Department = require('../models/Department');
const DailyCash = require('../models/DailyCash');

// @desc    Get Income Statement Report
// @route   GET /api/v1/income-statement
// @access  Private
exports.getIncomeStatement = async (req, res) => {
    try {
        const { branch, startDate, endDate } = req.query;

        if (!branch || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide branch, startDate, and endDate'
            });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        console.log('Income Statement Request:', { branch, startDate, endDate });

        // Fetch closing sheets for the period
        const sheets = await ClosingSheet.find({
            branch,
            date: { $gte: start, $lte: end }
        }).lean();

        console.log('Found closing sheets:', sheets.length);

        // Collect all department IDs from closing02 data
        const allDeptIds = new Set();
        sheets.forEach(sheet => {
            if (sheet.closing02 && sheet.closing02.data) {
                Object.keys(sheet.closing02.data).forEach(deptId => {
                    allDeptIds.add(deptId);
                    // Also collect sub-department IDs from salesBreakdown
                    const dData = sheet.closing02.data[deptId];
                    if (dData.salesBreakdown) {
                        Object.keys(dData.salesBreakdown).forEach(subId => allDeptIds.add(subId));
                    }
                });
            }
        });

        // Filter valid ObjectIds
        const mongoose = require('mongoose');
        const validDeptIds = Array.from(allDeptIds).filter(id => mongoose.isValidObjectId(id));

        // Fetch all departments
        const departments = await Department.find({
            _id: { $in: validDeptIds },
            closing2CompSale: true  // Only departments marked for Closing Sheet 2
        }).populate('parentDepartment').lean();

        console.log('Found departments with closing2CompSale:', departments.length);

        // Create department ID to name map
        const deptIdToName = new Map();
        const deptIdToObj = new Map();
        departments.forEach(dept => {
            deptIdToName.set(dept._id.toString(), dept.name);
            deptIdToObj.set(dept._id.toString(), dept);
        });

        // Aggregate data by parent department
        const departmentGroups = new Map();

        for (const sheet of sheets) {
            if (!sheet.closing02 || !sheet.closing02.data) continue;

            const closing02Data = sheet.closing02.data;

            // Process each department in closing02
            for (const [deptId, deptData] of Object.entries(closing02Data)) {
                if (!deptData) continue;

                const dept = deptIdToObj.get(deptId);
                if (!dept) continue; // Skip if not in our filtered departments

                const parentDept = dept.parentDepartment || dept;
                const parentId = parentDept._id.toString();
                const parentName = parentDept.name;

                // Initialize parent group if not exists
                if (!departmentGroups.has(parentId)) {
                    departmentGroups.set(parentId, {
                        parentName: parentName,
                        parentId: parentId,
                        subDepartments: new Map(), // Use Map to aggregate sub-departments
                        totals: {
                            sales: 0,
                            cost: 0,
                            bankDeduction: 0,
                            grossProfit: 0,
                            discount: 0,
                            gpProfit: 0
                        }
                    });
                }

                const group = departmentGroups.get(parentId);

                // Check if this department has breakdown
                if (deptData.salesBreakdown && Object.keys(deptData.salesBreakdown).length > 0) {
                    // Process breakdown (sub-departments)
                    const totalSale = parseFloat(deptData.totalSaleComputer) || 0;
                    const totalDisc = parseFloat(deptData.discountValue) || 0;

                    Object.entries(deptData.salesBreakdown).forEach(([subId, subData]) => {
                        if (!subData) return;

                        const subDeptName = deptIdToName.get(subId) || 'UNKNOWN';
                        const subSale = parseFloat(subData.sale) || 0;

                        // Prorate discount
                        let subDiscVal = 0;
                        if (totalSale !== 0) {
                            subDiscVal = (subSale / totalSale) * totalDisc;
                        }

                        // Calculate cost (70% assumption)
                        const subCost = subSale * 0.7;

                        // Calculate gross profit
                        const subGross = subSale - subCost;

                        // GP Profit after discount
                        const subGpProfit = subGross - subDiscVal;

                        // Initialize or update sub-department
                        if (!group.subDepartments.has(subId)) {
                            group.subDepartments.set(subId, {
                                department: subDeptName,
                                departmentId: subId,
                                sales: 0,
                                cost: 0,
                                bankDeduction: 0,
                                grossProfit: 0,
                                discount: 0,
                                gpProfit: 0
                            });
                        }

                        const subDept = group.subDepartments.get(subId);
                        subDept.sales += subSale;
                        subDept.cost += subCost;
                        subDept.discount += subDiscVal;
                        subDept.grossProfit += subGross;
                        subDept.gpProfit += subGpProfit;
                    });
                } else {
                    // No breakdown - treat as single department
                    const sale = parseFloat(deptData.totalSaleComputer) || 0;
                    const discVal = parseFloat(deptData.discountValue) || 0;
                    const cost = sale * 0.7;
                    const gross = sale - cost;
                    const gpProfit = gross - discVal;

                    if (!group.subDepartments.has(deptId)) {
                        group.subDepartments.set(deptId, {
                            department: dept.name,
                            departmentId: deptId,
                            sales: 0,
                            cost: 0,
                            bankDeduction: 0,
                            grossProfit: 0,
                            discount: 0,
                            gpProfit: 0
                        });
                    }

                    const subDept = group.subDepartments.get(deptId);
                    subDept.sales += sale;
                    subDept.cost += cost;
                    subDept.discount += discVal;
                    subDept.grossProfit += gross;
                    subDept.gpProfit += gpProfit;
                }
            }
        }

        // Convert Maps to Arrays and calculate totals
        const groupedData = Array.from(departmentGroups.values()).map(group => {
            const subDepts = Array.from(group.subDepartments.values()).map(dept => ({
                ...dept,
                sales: Math.round(dept.sales),
                cost: Math.round(dept.cost),
                bankDeduction: Math.round(dept.bankDeduction),
                grossProfit: Math.round(dept.grossProfit),
                discount: Math.round(dept.discount),
                gpProfit: Math.round(dept.gpProfit)
            }));

            // Calculate group totals
            group.totals = subDepts.reduce((acc, dept) => ({
                sales: acc.sales + dept.sales,
                cost: acc.cost + dept.cost,
                bankDeduction: acc.bankDeduction + dept.bankDeduction,
                grossProfit: acc.grossProfit + dept.grossProfit,
                discount: acc.discount + dept.discount,
                gpProfit: acc.gpProfit + dept.gpProfit
            }), {
                sales: 0,
                cost: 0,
                bankDeduction: 0,
                grossProfit: 0,
                discount: 0,
                gpProfit: 0
            });

            return {
                ...group,
                subDepartments: subDepts
            };
        });

        console.log('Department groups:', groupedData.length);

        // Calculate grand totals
        const grandTotals = groupedData.reduce((acc, group) => ({
            sales: acc.sales + group.totals.sales,
            cost: acc.cost + group.totals.cost,
            bankDeduction: acc.bankDeduction + group.totals.bankDeduction,
            grossProfit: acc.grossProfit + group.totals.grossProfit,
            discount: acc.discount + group.totals.discount,
            gpProfit: acc.gpProfit + group.totals.gpProfit
        }), {
            sales: 0,
            cost: 0,
            bankDeduction: 0,
            grossProfit: 0,
            discount: 0,
            gpProfit: 0
        });

        // Get Sale Returns
        const saleReturns = await SalesReturn.find({
            branch,
            date: { $gte: start, $lte: end },
            status: 'final'
        });

        const totalSaleReturns = saleReturns.reduce((sum, ret) => sum + (ret.totalAmount || 0), 0);

        // Calculate Net Sales
        const netSales = grandTotals.sales - totalSaleReturns;

        // Get total expenses
        const expenses = await Expense.find({
            branch,
            date: { $gte: start, $lte: end }
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

        // Short Cash (placeholder)
        const shortCash = 0;

        // Calculate Net Profit
        const netProfit = grandTotals.gpProfit - totalExpenses - shortCash;

        // Summary section
        const summary = {
            totalSale: Math.round(grandTotals.sales),
            totalSaleReturns: Math.round(totalSaleReturns),
            netSales: Math.round(netSales),
            cost: Math.round(grandTotals.cost),
            grossProfit: Math.round(grandTotals.grossProfit),
            expenses: Math.round(totalExpenses),
            shortCash: Math.round(shortCash),
            netProfit: Math.round(netProfit)
        };

        res.status(200).json({
            success: true,
            data: {
                groups: groupedData,
                totals: grandTotals,
                summary,
                period: {
                    startDate: start,
                    endDate: end,
                    branch
                }
            }
        });

    } catch (error) {
        console.error('Error generating income statement:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating income statement',
            error: error.message
        });
    }
};
