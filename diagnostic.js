// Diagnostic script to identify Oracle Client installation issues
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Oracle Client Diagnostic Report ===\n');

// 1. Check Node.js architecture and version
console.log('1. Node.js Environment:');
console.log(`   Version: ${process.version}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Architecture: ${process.arch}`);
console.log(`   Process bits: ${process.arch === 'x64' ? '64-bit' : '32-bit'}`);

// 2. Check if Oracle Client path exists
const oracleClientPath = 'C:\\instantclient-basic-windows\\instantclient_23_8';
console.log('\n2. Oracle Client Path Check:');
console.log(`   Configured path: ${oracleClientPath}`);
console.log(`   Path exists: ${fs.existsSync(oracleClientPath)}`);
if (fs.existsSync(oracleClientPath)) {
    const files = fs.readdirSync(oracleClientPath);
    console.log(`   Contains ${files.length} files/directories`);
    console.log(`   Key files present:`, files.filter(f => f.includes('oci.dll') || f.includes('orannzsbb') || f.includes('oraocci')));
} else {
    console.log('   ❌ Oracle Client directory not found at specified path');
}

// 3. Check PATH environment variable
console.log('\n3. PATH Environment Variable:');
const pathEnv = process.env.PATH || '';
const pathEntries = pathEnv.split(path.delimiter);
const oracleInPath = pathEntries.some(p => p.includes('instantclient') || p.includes('oracle'));
console.log(`   Oracle in PATH: ${oracleInPath ? '✅ Yes' : '❌ No'}`);
if (oracleInPath) {
    console.log('   Oracle paths found:', pathEntries.filter(p => p.includes('instantclient') || p.includes('oracle')));
}

// 4. Check for Visual Studio Redistributable
console.log('\n4. Visual Studio Redistributable Check:');
try {
    const result = execSync('wmic product where "name like \'%Visual C++%\'" get name,version', { encoding: 'utf8', timeout: 5000 });
    const lines = result.split('\n').filter(line => line.trim() && !line.includes('Name') && !line.includes('Version'));
    console.log('   Installed Visual C++ Redistributables:');
    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
            console.log(`   - ${parts.slice(0, -1).join(' ')} v${parts[parts.length - 1]}`);
        }
    });
} catch (error) {
    console.log('   Could not check Visual C++ Redistributables');
}

// 5. Check oracledb package installation
console.log('\n5. OracleDB Package Check:');
try {
    const oracledb = require('oracledb');
    console.log(`   oracledb version: ${oracledb.versionString || 'Unknown'}`);
    console.log(`   Thick mode supported: ${oracledb.oracleClientVersionString ? 'Yes' : 'Unknown'}`);
} catch (error) {
    console.log(`   ❌ Error loading oracledb: ${error.message}`);
}

// 6. Common Oracle Client installation paths
console.log('\n6. Common Oracle Client Installation Paths:');
const commonPaths = [
    'C:\\oracle\\instantclient_23_8',
    'C:\\oracle\\instantclient_19_23',
    'C:\\oracle\\instantclient_21_12',
    'C:\\app\\oracle\\product\\23.0.0\\dbhome_1\\bin',
    'C:\\Program Files\\Oracle\\instantclient_23_8',
    'C:\\Program Files (x86)\\Oracle\\instantclient_23_8'
];

commonPaths.forEach(p => {
    const exists = fs.existsSync(p);
    console.log(`   ${exists ? '✅' : '❌'} ${p}`);
    if (exists) {
        try {
            const files = fs.readdirSync(p).filter(f => f.includes('oci.dll'));
            if (files.length > 0) {
                console.log(`      Contains: ${files.join(', ')}`);
            }
        } catch (e) {
            console.log(`      Access denied`);
        }
    }
});

console.log('\n=== Recommendations ===');
console.log('If Oracle Client is not installed:');
console.log('1. Download Oracle Instant Client from Oracle website');
console.log('2. Extract to a directory (e.g., C:\\instantclient-basic-windows\\instantclient_23_8)');
console.log('3. Add the path to PATH environment variable');
console.log('4. Update db/oracle.js with the correct path if different');
console.log('\nIf Oracle Client is installed but not working:');
console.log('1. Ensure 64-bit Oracle Client matches your 64-bit Node.js');
console.log('2. Install Visual Studio Redistributable (64-bit)');
console.log('3. Restart your terminal/command prompt after PATH changes');