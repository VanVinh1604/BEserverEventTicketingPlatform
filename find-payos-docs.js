// find-payos-docs.js - Tìm documentation
const fs = require('fs');
const path = require('path');

const payosPath = path.join(__dirname, 'node_modules', '@payos', 'node');

console.log("📚 Tìm kiếm documentation cho @payos/node\n");
console.log("📂 Path:", payosPath);

if (!fs.existsSync(payosPath)) {
    console.log("❌ Không tìm thấy package");
    process.exit(1);
}

console.log("\n📄 Các files trong package:");
const files = fs.readdirSync(payosPath);
files.forEach(file => {
    const filePath = path.join(payosPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
        console.log(`   - ${file}`);
    }
});

// Tìm README
const readmeFiles = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
for (const readme of readmeFiles) {
    const readmePath = path.join(payosPath, readme);
    if (fs.existsSync(readmePath)) {
        console.log(`\n📖 Tìm thấy ${readme}:`);
        console.log("=" .repeat(60));
        const content = fs.readFileSync(readmePath, 'utf8');
        console.log(content.substring(0, 2000)); // In 2000 ký tự đầu
        console.log("=" .repeat(60));
        break;
    }
}

// Tìm package.json để xem thông tin
const pkgPath = path.join(payosPath, 'package.json');
if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log("\n📦 Package info:");
    console.log("   - Name:", pkg.name);
    console.log("   - Version:", pkg.version);
    console.log("   - Homepage:", pkg.homepage);
    console.log("   - Repository:", pkg.repository?.url);
}

console.log("\n💡 Xem thêm tại: https://github.com/payOSHQ/payos-node");
console.log("💡 Hoặc: https://payos.vn/docs/");
