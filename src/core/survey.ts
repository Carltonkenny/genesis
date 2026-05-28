import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type {
  ProjectSurvey,
  DirectoryInfo,
  Dependency,
  ImportEdge,
  ConfigFile,
  DeployInfo,
  TestInfo,
} from '../types.js';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.venv', 'venv',
  'dist', 'build', '.next', '.turbo', 'coverage', '.pytest_cache',
  '.mypy_cache', '.ruff_cache', 'target', '.idea', '.vscode',
]);

const LANGUAGE_DETECTORS: Record<string, { language: string; framework?: string; packageManager: string }> = {
  'package.json': { language: 'TypeScript', packageManager: 'npm' },
  'requirements.txt': { language: 'Python', framework: 'pip', packageManager: 'pip' },
  'pyproject.toml': { language: 'Python', packageManager: 'poetry' },
  'go.mod': { language: 'Go', packageManager: 'go modules' },
  'Cargo.toml': { language: 'Rust', packageManager: 'cargo' },
  'Gemfile': { language: 'Ruby', packageManager: 'bundler' },
  'composer.json': { language: 'PHP', packageManager: 'composer' },
  'pom.xml': { language: 'Java', packageManager: 'maven' },
  'build.gradle': { language: 'Java/Kotlin', packageManager: 'gradle' },
};

const CONFIG_PATTERNS: Record<string, ConfigFile['type']> = {
  '.env': 'env',
  'Dockerfile': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  'render.yaml': 'deploy',
  'vercel.json': 'deploy',
  'netlify.toml': 'deploy',
};

const CI_PATTERNS = ['.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile', '.circleci'];

const TEST_FRAMEWORKS: Record<string, string> = {
  'pytest': 'pytest',
  'jest': 'jest',
  'vitest': 'vitest',
  'mocha': 'mocha',
  'jasmine': 'jasmine',
  'go test': 'go test',
  'cargo test': 'cargo test',
};

function detectFramework(deps: string[], language: string): string | undefined {
  const patterns: Record<string, string> = {
    fastapi: 'FastAPI',
    flask: 'Flask',
    django: 'Django',
    express: 'Express',
    next: 'Next.js',
    nuxt: 'Nuxt',
    react: 'React',
    gin: 'Gin',
    fiber: 'Fiber',
    'echo': 'Echo',
    'rocket': 'Rocket',
    'axum': 'Axum',
    'actix': 'Actix',
  };
  for (const [key, name] of Object.entries(patterns)) {
    if (deps.some((d) => d.toLowerCase().includes(key))) return name;
  }
  return undefined;
}

export async function survey(dir: string): Promise<ProjectSurvey> {
  const absDir = dir;

  // Build directory tree
  const rootInfo = await buildDirectoryTree(absDir, '');

  // Detect language
  let language = 'Unknown';
  let framework: string | undefined;
  let packageManager = 'none';

  for (const [file, detector] of Object.entries(LANGUAGE_DETECTORS)) {
    const exists = rootInfo.files.some((f) => f.toLowerCase() === file.toLowerCase());
    if (exists) {
      language = detector.language;
      packageManager = detector.packageManager;
      break;
    }
  }

  // Fallback: detect from file extensions if no config file matched
  if (language === 'Unknown') {
    const allFiles = collectAllFiles(rootInfo);
    const exts = allFiles.map(f => f.split('.').pop()?.toLowerCase());
    if (exts.some(e => e === 'py')) { language = 'Python'; packageManager = 'pip'; }
    else if (exts.some(e => e === 'ts' || e === 'tsx')) { language = 'TypeScript'; packageManager = 'npm'; }
    else if (exts.some(e => e === 'js' || e === 'jsx')) { language = 'JavaScript'; packageManager = 'npm'; }
    else if (exts.some(e => e === 'go')) { language = 'Go'; packageManager = 'go modules'; }
    else if (exts.some(e => e === 'rs')) { language = 'Rust'; packageManager = 'cargo'; }
  }

  // Try reading dependency files for framework detection
  const deps = await extractDependencies(absDir, packageManager);
  framework = detectFramework(deps.map((d) => d.name), language);

  // Entry points
  const entryPoints = findEntryPoints(rootInfo, language);

  // Config files
  const configFiles = findConfigFiles(rootInfo);

  // Test structure
  const testStructure = findTestStructure(rootInfo, packageManager);

  // Deploy artifacts
  const deployArtifacts = findDeployArtifacts(rootInfo);

  // Import graph (simplified, regex-based)
  const importGraph = await buildImportGraph(absDir, rootInfo, language);

  return {
    name: absDir.split(/[/\\]/).pop() || 'project',
    language,
    framework,
    packageManager,
    directories: rootInfo.subdirectories,
    entryPoints,
    dependencies: deps,
    configFiles,
    testStructure,
    deployArtifacts,
    importGraph,
    files: rootInfo.files,
  };
}

async function buildDirectoryTree(baseDir: string, relPath: string): Promise<DirectoryInfo & { files: string[] }> {
  const fullPath = join(baseDir, relPath);
  const files: string[] = [];
  const subdirectories: DirectoryInfo[] = [];

  let entries;
  try {
    entries = await readdir(fullPath, { withFileTypes: true });
  } catch {
    return { path: relPath || '.', fileCount: 0, files: [], subdirectories };
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue; // Skip hidden dirs except for CI
      const sub = await buildDirectoryTree(baseDir, entryRelPath);
      if (sub.fileCount > 0 || sub.subdirectories.length > 0) {
        subdirectories.push(sub);
      }
    } else if (entry.isFile()) {
      files.push(entryRelPath);
    }
  }

  return {
    path: relPath || '.',
    fileCount: files.length + subdirectories.reduce((s, d) => s + d.fileCount, 0),
    files,
    subdirectories,
  };
}

async function extractDependencies(dir: string, pm: string): Promise<Dependency[]> {
  const deps: Dependency[] = [];

  try {
    if (pm === 'npm') {
      const pkgJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf-8'));
      for (const [name, version] of Object.entries(pkgJson.dependencies || {})) {
        deps.push({ name, version: version as string, type: 'runtime' });
      }
      for (const [name, version] of Object.entries(pkgJson.devDependencies || {})) {
        deps.push({ name, version: version as string, type: 'dev' });
      }
    } else if (pm === 'pip' || pm === 'poetry') {
      try {
        const reqTxt = await readFile(join(dir, 'requirements.txt'), 'utf-8');
        for (const line of reqTxt.split('\n')) {
          const cleaned = line.split('#')[0]?.trim();
          if (!cleaned) continue;
          const [pkg, ver] = cleaned.split(/[=<>~!]+/);
          if (pkg) deps.push({ name: pkg.trim(), version: ver?.trim() || '*', type: 'runtime' });
        }
      } catch { /* no requirements.txt */ }
    }
  } catch { /* dependency file not parseable */ }

  return deps;
}

function findEntryPoints(root: { files: string[] }, language: string): string[] {
  const patterns: Record<string, RegExp[]> = {
    Python: [/^main\.py$/, /^app\.py$/, /^wsgi\.py$/],
    TypeScript: [/^index\.ts$/, /^index\.tsx$/, /^server\.ts$/],
    JavaScript: [/^index\.js$/, /^app\.js$/, /^server\.js$/],
    Go: [/^main\.go$/],
  };

  const langPatterns = patterns[language] || [/^index\./];
  return root.files.filter((f) =>
    langPatterns.some((p) => p.test(f.split('/').pop() || f))
  );
}

function findConfigFiles(root: { files: string[]; subdirectories: DirectoryInfo[] }): ConfigFile[] {
  const configs: ConfigFile[] = [];
  const rootDir = root;

  for (const file of rootDir.files) {
    const baseName = file.includes('/') ? file.split('/').pop()! : file;
    const type = CONFIG_PATTERNS[baseName];
    if (type) configs.push({ path: file, type });
  }

  // Check for CI configs
  for (const sub of rootDir.subdirectories) {
    for (const ci of CI_PATTERNS) {
      if (sub.path.startsWith(ci) || sub.path.includes(ci)) {
        configs.push({ path: sub.path, type: 'ci' });
      }
    }
  }

  return configs;
}

function findTestStructure(root: { files: string[]; subdirectories: DirectoryInfo[] }, pm: string): TestInfo | undefined {
  let framework: string | undefined;

  for (const [key, name] of Object.entries(TEST_FRAMEWORKS)) {
    if (pm === 'npm') {
      if (root.files.some((f) => f.includes('jest.config') || f.includes('vitest.config'))) {
        framework = name;
        break;
      }
    }
    if (root.files.some((f) => f.includes('pytest') || f.includes('conftest.py'))) {
      framework = 'pytest';
      break;
    }
  }

  if (!framework) return undefined;

  const testDir = root.subdirectories.find(
    (d) => d.path === 'tests' || d.path === 'test' || d.path === '__tests__'
  );

  if (!testDir) return undefined;

  return {
    framework,
    directory: testDir.path,
    totalTests: testDir.fileCount,
    files: testDir.files,
  };
}

function findDeployArtifacts(root: { files: string[]; subdirectories: DirectoryInfo[] }): DeployInfo[] {
  const artifacts: DeployInfo[] = [];

  for (const file of root.files) {
    const base = file.toLowerCase();
    if (base.includes('dockerfile')) {
      artifacts.push({ path: file, type: 'dockerfile' });
    } else if (base.includes('docker-compose')) {
      artifacts.push({ path: file, type: 'docker-compose' });
    } else if (base === 'render.yaml' || base === 'render_start.sh') {
      artifacts.push({ path: file, type: 'render' });
    } else if (base === 'vercel.json') {
      artifacts.push({ path: file, type: 'vercel' });
    } else if (base === 'netlify.toml') {
      artifacts.push({ path: file, type: 'netlify' });
    }
  }

  for (const sub of root.subdirectories) {
    if (sub.path.includes('k8s') || sub.path.includes('kubernetes')) {
      artifacts.push({ path: sub.path, type: 'kubernetes' });
    }
  }

  return artifacts;
}

async function buildImportGraph(
  dir: string,
  root: { files: string[]; subdirectories: DirectoryInfo[] },
  language: string
): Promise<ImportEdge[]> {
  const edges: ImportEdge[] = [];
  const allFiles = collectAllFiles(root);

  // Sample up to 200 files for import analysis (avoid scanning 50K files)
  const sampleFiles = allFiles.slice(0, 200);

  for (const file of sampleFiles) {
    try {
      const content = await readFile(join(dir, file), 'utf-8');
      const imports = extractImports(content, language);

      for (const imp of imports) {
        edges.push({
          from: file,
          to: imp,
          type: 'direct',
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return edges;
}

function extractImports(content: string, language: string): string[] {
  const imports: string[] = [];

  if (language === 'Python' || language.includes('Python')) {
    // from X import Y
    const fromRegex = /from\s+([.\w]+)\s+import/g;
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      imports.push(match[1]!);
    }
    // import X
    const importRegex = /^import\s+([.\w]+)/gm;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]!);
    }
  } else if (language === 'TypeScript' || language === 'JavaScript' || language.includes('Script')) {
    // import X from 'Y'
    const importRegex = /(?:import|require)\s*\(?["']([^"']+)["']\)?/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]!);
    }
  } else if (language === 'Go') {
    const importBlockRegex = /import\s*\((.*?)\)/gs;
    let blockMatch;
    while ((blockMatch = importBlockRegex.exec(content)) !== null) {
      const singleRegex = /"([^"]+)"/g;
      let singleMatch;
      while ((singleMatch = singleRegex.exec(blockMatch[1]!)) !== null) {
        imports.push(singleMatch[1]!);
      }
    }
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let sMatch;
    while ((sMatch = singleImportRegex.exec(content)) !== null) {
      imports.push(sMatch[1]!);
    }
  }

  return imports;
}

function collectAllFiles(info: { files: string[]; subdirectories: DirectoryInfo[] }): string[] {
  let all: string[] = [...info.files];
  for (const sub of info.subdirectories) {
    all = all.concat(collectAllFiles(sub));
  }
  return all;
}
