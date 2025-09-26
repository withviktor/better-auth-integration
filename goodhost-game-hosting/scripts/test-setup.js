#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing GoodHost Game Hosting Setup...\n');

// Test 1: Check if required files exist
console.log('1. Checking required files...');
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'src/server/index.ts',
  'src/client/pages/_app.tsx',
  'src/shared/db/schema.ts',
  'docker-compose.yml',
  'Dockerfile'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing. Please check the setup.');
  process.exit(1);
}

// Test 2: Check if dependencies are installed
console.log('\n2. Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const nodeModulesExists = fs.existsSync('node_modules');
  
  if (nodeModulesExists) {
    console.log('   ✅ node_modules directory exists');
  } else {
    console.log('   ❌ node_modules directory missing - run npm install');
    process.exit(1);
  }
} catch (error) {
  console.log('   ❌ Error reading package.json');
  process.exit(1);
}

// Test 3: Check TypeScript compilation
console.log('\n3. Testing TypeScript compilation...');
try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('   ✅ TypeScript compilation successful');
} catch (error) {
  console.log('   ❌ TypeScript compilation failed');
  console.log('   Error:', error.message);
  process.exit(1);
}

// Test 4: Check if Docker is available
console.log('\n4. Checking Docker availability...');
try {
  execSync('docker --version', { stdio: 'pipe' });
  console.log('   ✅ Docker is available');
} catch (error) {
  console.log('   ⚠️  Docker not available - required for container management');
}

// Test 5: Check database schema
console.log('\n5. Checking database schema...');
try {
  const schemaContent = fs.readFileSync('src/shared/db/schema.ts', 'utf8');
  if (schemaContent.includes('sqliteTable') && schemaContent.includes('users')) {
    console.log('   ✅ Database schema looks good');
  } else {
    console.log('   ❌ Database schema appears incomplete');
  }
} catch (error) {
  console.log('   ❌ Error reading database schema');
}

console.log('\n🎉 Setup test completed!');
console.log('\nNext steps:');
console.log('1. Run: npm run db:push');
console.log('2. Run: npm run dev');
console.log('3. Open: http://localhost:3000');
console.log('\nFor production deployment:');
console.log('1. Run: docker-compose up -d');
console.log('2. Access: http://localhost');