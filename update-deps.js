const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Dependencies to keep at their current versions due to compatibility issues
const keepVersions = [
  'core-js', // Keeping at 2.x as upgrading to 3.x might break the application
  'passport', // Keeping at 0.4.1 as newer versions have breaking changes
  'nuxt', // Keeping at 2.x as upgrading to 3.x would require major changes
  '@nuxt/typescript-runtime', // Keep compatible with Nuxt 2.x
  'mongoose', // Keeping at 5.x as upgrading to 6.x or 7.x would require schema changes
  'mongodb', // Keep compatible with mongoose 5.x
];

// Dependencies to remove (identified as unused by depcheck)
const removeDeps = [
  '@jimp/plugin-print',
  'nuxt-env',
  'query-string',
  'request-promise-native',
  'sharp',
  'snyk',
  'tsc',
  'universal-analytics',
];

// Dev dependencies to remove
const removeDevDeps = [
  '@commitlint/cli',
  '@commitlint/config-conventional',
  '@types/express-serve-static-core',
  '@types/jquery',
  '@types/universal-analytics',
  'commitizen',
  'webpack-hot-middleware',
];

// Update dependencies
console.log('Updating dependencies...');
Object.keys(packageJson.dependencies).forEach(dep => {
  if (!keepVersions.includes(dep) && !removeDeps.includes(dep)) {
    try {
      const latestVersion = execSync(`npm view ${dep} version`, { encoding: 'utf8' }).trim();
      console.log(`Updating ${dep} from ${packageJson.dependencies[dep]} to ${latestVersion}`);
      packageJson.dependencies[dep] = `^${latestVersion}`;
    } catch (error) {
      console.error(`Error getting latest version for ${dep}:`, error.message);
    }
  }
});

// Update dev dependencies
console.log('\nUpdating dev dependencies...');
Object.keys(packageJson.devDependencies).forEach(dep => {
  if (!keepVersions.includes(dep) && !removeDevDeps.includes(dep)) {
    try {
      const latestVersion = execSync(`npm view ${dep} version`, { encoding: 'utf8' }).trim();
      console.log(`Updating ${dep} from ${packageJson.devDependencies[dep]} to ${latestVersion}`);
      packageJson.devDependencies[dep] = `^${latestVersion}`;
    } catch (error) {
      console.error(`Error getting latest version for ${dep}:`, error.message);
    }
  }
});

// Remove unused dependencies
console.log('\nRemoving unused dependencies...');
removeDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`Removing ${dep}`);
    delete packageJson.dependencies[dep];
  }
});

// Remove unused dev dependencies
console.log('\nRemoving unused dev dependencies...');
removeDevDeps.forEach(dep => {
  if (packageJson.devDependencies[dep]) {
    console.log(`Removing ${dep}`);
    delete packageJson.devDependencies[dep];
  }
});

// Add missing dependencies
console.log('\nAdding missing dependencies...');
const missingDeps = {
  'vue': '^2.7.16', // Compatible with Nuxt 2.x
  'axios': '^1.6.8',
  'vue-property-decorator': '^9.1.2',
};

Object.entries(missingDeps).forEach(([dep, version]) => {
  if (!packageJson.dependencies[dep]) {
    console.log(`Adding ${dep} at ${version}`);
    packageJson.dependencies[dep] = version;
  }
});

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('\npackage.json updated. Run npm install to apply changes.');