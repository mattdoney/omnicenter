import { exec } from 'child_process';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function findJsFiles(dir) {
  let results = [];
  const items = await readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(await findJsFiles(path));
    } else if (item.name.endsWith('.js')) {
      results.push(path);
    }
  }
  
  return results;
}

async function updateImports(content) {
  // Update relative imports to include .mjs extension
  return content.replace(/from ['"]([^'"]+)['"]/g, (match, importPath) => {
    if (importPath.startsWith('.') && !importPath.endsWith('.mjs')) {
      // Don't add .mjs to imports that already have an extension
      if (!importPath.match(/\.[a-zA-Z0-9]+$/)) {
        return `from '${importPath}.mjs'`;
      }
    }
    return match;
  });
}

async function main() {
  try {
    // Run TypeScript compilation
    console.log('TypeScript compilation started');
    const { stdout, stderr } = await execAsync('tsc -p tsconfig.server.json');
    if (stderr) {
      console.error('TypeScript compilation error:', stderr);
      process.exit(1);
    }
    console.log('TypeScript compilation completed');

    // Find all JS files in the dist directory
    const distDir = join(process.cwd(), 'dist');
    const jsFiles = await findJsFiles(distDir);

    // Process each JS file
    for (const file of jsFiles) {
      // Read the file content
      let content = await readFile(file, 'utf8');

      // Update import statements
      content = await updateImports(content);

      // Write back the updated content
      const mjsFile = file.replace(/\.js$/, '.mjs');
      await writeFile(mjsFile, content);
      console.log(`Renamed ${file} to ${mjsFile}`);
    }

    // Update server.mjs imports
    const serverPath = join(process.cwd(), 'server.mjs');
    let serverContent = await readFile(serverPath, 'utf8');
    serverContent = await updateImports(serverContent);
    await writeFile(serverPath, serverContent);
    console.log('Updated server.mjs imports');

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();
