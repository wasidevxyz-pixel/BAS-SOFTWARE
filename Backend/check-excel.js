const xlsx = require('xlsx');
const path = require('path');
const filePath = path.join(__dirname, '../export/Suppliers Dwatson (1).xlsx');
const workbook = xlsx.readFile(filePath);

console.log('Sheets found:', workbook.SheetNames);

let total = 0;
workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Sheet '${name}': ${data.length} rows.`);
    total += data.length;
});
console.log(`Grand Total: ${total}`);
