"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addTestCommands = addTestCommands;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _runner = require("./runner/runner");
var _utils = require("playwright-core/lib/utils");
var _util = require("./util");
var _html = require("./reporters/html");
var _blob = require("./reporters/blob");
var _configLoader = require("./common/configLoader");
var _config = require("./common/config");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

function addTestCommands(program) {
  addTestCommand(program);
  addShowReportCommand(program);
  addListFilesCommand(program);
  addMergeReportsCommand(program);
}
function addTestCommand(program) {
  const command = program.command('test [test-filter...]');
  command.description('run tests with Playwright Test');
  const options = testOptions.sort((a, b) => a[0].replace(/-/g, '').localeCompare(b[0].replace(/-/g, '')));
  options.forEach(([name, description]) => command.option(name, description));
  command.action(async (args, opts) => {
    try {
      await runTests(args, opts);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
  command.addHelpText('afterAll', `
Arguments [test-filter...]:
  Pass arguments to filter test files. Each argument is treated as a regular expression. Matching is performed against the absolute file paths.

Examples:
  $ npx playwright test my.spec.ts
  $ npx playwright test some.spec.ts:42
  $ npx playwright test --headed
  $ npx playwright test --project=webkit`);
}
function addListFilesCommand(program) {
  const command = program.command('list-files [file-filter...]', {
    hidden: true
  });
  command.description('List files with Playwright Test tests');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional ${_configLoader.kDefaultConfigFiles.map(file => `"${file}"`).join('/')}`);
  command.option('--project <project-name...>', `Only run tests from the specified list of projects (default: list all projects)`);
  command.action(async (args, opts) => {
    try {
      await listTestFiles(opts);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
}
function addShowReportCommand(program) {
  const command = program.command('show-report [report]');
  command.description('show HTML report');
  command.action((report, options) => (0, _html.showHTMLReport)(report, options.host, +options.port));
  command.option('--host <host>', 'Host to serve report on', 'localhost');
  command.option('--port <port>', 'Port to serve report on', '9323');
  command.addHelpText('afterAll', `
Arguments [report]:
  When specified, opens given report, otherwise opens last generated report.

Examples:
  $ npx playwright show-report
  $ npx playwright show-report playwright-report`);
}
function addMergeReportsCommand(program) {
  const command = program.command('merge-reports [dir]', {
    hidden: true
  });
  command.description('merge multiple blob reports (for sharded tests) into a single report');
  command.action(async (dir, options) => {
    try {
      await mergeReports(dir, options);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
  command.option('-c, --config <file>', `Configuration file. Can be used to specify additional configuration for the output report.`);
  command.option('--reporter <reporter>', 'Output report type', 'list');
  command.addHelpText('afterAll', `
Arguments [dir]:
  Directory containing blob reports.

Examples:
  $ npx playwright merge-reports playwright-report`);
}
async function runTests(args, opts) {
  await (0, _utils.startProfiling)();

  // When no --config option is passed, let's look for the config file in the current directory.
  const configFileOrDirectory = opts.config ? _path.default.resolve(process.cwd(), opts.config) : process.cwd();
  const resolvedConfigFile = (0, _configLoader.resolveConfigFile)(configFileOrDirectory);
  if (restartWithExperimentalTsEsm(resolvedConfigFile)) return;
  const overrides = overridesFromOptions(opts);
  const configLoader = new _configLoader.ConfigLoader(overrides);
  let config;
  if (resolvedConfigFile) config = await configLoader.loadConfigFile(resolvedConfigFile, opts.deps === false);else config = await configLoader.loadEmptyConfig(configFileOrDirectory);
  config.cliArgs = args;
  config.cliGrep = opts.grep;
  config.cliGrepInvert = opts.grepInvert;
  config.cliListOnly = !!opts.list;
  config.cliProjectFilter = opts.project || undefined;
  config.cliPassWithNoTests = !!opts.passWithNoTests;
  const runner = new _runner.Runner(config);
  let status;
  if (opts.ui) status = await runner.uiAllTests();else if (process.env.PWTEST_WATCH) status = await runner.watchAllTests();else status = await runner.runAllTests();
  await (0, _utils.stopProfiling)('runner');
  if (status === 'interrupted') process.exit(130);
  process.exit(status === 'passed' ? 0 : 1);
}
async function listTestFiles(opts) {
  // Redefine process.stdout.write in case config decides to pollute stdio.
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => {};
  const configFileOrDirectory = opts.config ? _path.default.resolve(process.cwd(), opts.config) : process.cwd();
  const resolvedConfigFile = (0, _configLoader.resolveConfigFile)(configFileOrDirectory);
  if (restartWithExperimentalTsEsm(resolvedConfigFile)) return;
  const configLoader = new _configLoader.ConfigLoader();
  const config = await configLoader.loadConfigFile(resolvedConfigFile);
  const runner = new _runner.Runner(config);
  const report = await runner.listTestFiles(opts.project);
  write(JSON.stringify(report), () => {
    process.exit(0);
  });
}
async function mergeReports(reportDir, opts) {
  let configFile = opts.config;
  if (configFile) {
    configFile = _path.default.resolve(process.cwd(), configFile);
    if (!_fs.default.existsSync(configFile)) throw new Error(`${configFile} does not exist`);
    if (!_fs.default.statSync(configFile).isFile()) throw new Error(`${configFile} is not a file`);
  }
  if (restartWithExperimentalTsEsm(configFile)) return;
  const configLoader = new _configLoader.ConfigLoader();
  const config = await (configFile ? configLoader.loadConfigFile(configFile) : configLoader.loadEmptyConfig(process.cwd()));
  const dir = _path.default.resolve(process.cwd(), reportDir || 'playwright-report');
  await (0, _blob.createMergedReport)(config, dir, opts.reporter || 'list');
}
function overridesFromOptions(options) {
  const shardPair = options.shard ? options.shard.split('/').map(t => parseInt(t, 10)) : undefined;
  const overrides = {
    forbidOnly: options.forbidOnly ? true : undefined,
    fullyParallel: options.fullyParallel ? true : undefined,
    globalTimeout: options.globalTimeout ? parseInt(options.globalTimeout, 10) : undefined,
    maxFailures: options.x ? 1 : options.maxFailures ? parseInt(options.maxFailures, 10) : undefined,
    outputDir: options.output ? _path.default.resolve(process.cwd(), options.output) : undefined,
    quiet: options.quiet ? options.quiet : undefined,
    repeatEach: options.repeatEach ? parseInt(options.repeatEach, 10) : undefined,
    retries: options.retries ? parseInt(options.retries, 10) : undefined,
    reporter: options.reporter && options.reporter.length ? options.reporter.split(',').map(r => [resolveReporter(r)]) : undefined,
    shard: shardPair ? {
      current: shardPair[0],
      total: shardPair[1]
    } : undefined,
    timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
    ignoreSnapshots: options.ignoreSnapshots ? !!options.ignoreSnapshots : undefined,
    updateSnapshots: options.updateSnapshots ? 'all' : undefined,
    workers: options.workers
  };
  if (options.browser) {
    const browserOpt = options.browser.toLowerCase();
    if (!['all', 'chromium', 'firefox', 'webkit'].includes(browserOpt)) throw new Error(`Unsupported browser "${options.browser}", must be one of "all", "chromium", "firefox" or "webkit"`);
    const browserNames = browserOpt === 'all' ? ['chromium', 'firefox', 'webkit'] : [browserOpt];
    overrides.projects = browserNames.map(browserName => {
      return {
        name: browserName,
        use: {
          browserName
        }
      };
    });
  }
  if (options.headed || options.debug) overrides.use = {
    headless: false
  };
  if (!options.ui && options.debug) {
    overrides.maxFailures = 1;
    overrides.timeout = 0;
    overrides.workers = 1;
    process.env.PWDEBUG = '1';
  }
  if (!options.ui && options.trace) {
    if (!kTraceModes.includes(options.trace)) throw new Error(`Unsupported trace mode "${options.trace}", must be one of ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`);
    overrides.use = overrides.use || {};
    overrides.use.trace = options.trace;
  }
  return overrides;
}
function resolveReporter(id) {
  if (_config.builtInReporters.includes(id)) return id;
  const localPath = _path.default.resolve(process.cwd(), id);
  if (_fs.default.existsSync(localPath)) return localPath;
  return require.resolve(id, {
    paths: [process.cwd()]
  });
}
function restartWithExperimentalTsEsm(configFile) {
  const nodeVersion = +process.versions.node.split('.')[0];
  // New experimental loader is only supported on Node 16+.
  if (nodeVersion < 16) return false;
  if (!configFile) return false;
  if (process.env.PW_DISABLE_TS_ESM) return false;
  if (process.env.PW_TS_ESM_ON) return false;
  if (!(0, _util.fileIsModule)(configFile)) return false;
  const NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + (0, _util.experimentalLoaderOption)();
  const innerProcess = require('child_process').fork(require.resolve('playwright-core/cli'), process.argv.slice(2), {
    env: {
      ...process.env,
      NODE_OPTIONS,
      PW_TS_ESM_ON: '1'
    }
  });
  innerProcess.on('close', code => {
    if (code !== 0 && code !== null) process.exit(code);
  });
  return true;
}
const kTraceModes = ['on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure'];
const testOptions = [['--browser <browser>', `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")`], ['-c, --config <file>', `Configuration file, or a test directory with optional ${_configLoader.kDefaultConfigFiles.map(file => `"${file}"`).join('/')}`], ['--debug', `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --max-failures=1 --headed --workers=1" options`], ['--forbid-only', `Fail if test.only is called (default: false)`], ['--fully-parallel', `Run all tests in parallel (default: false)`], ['--global-timeout <timeout>', `Maximum time this test suite can run in milliseconds (default: unlimited)`], ['-g, --grep <grep>', `Only run tests matching this regular expression (default: ".*")`], ['-gv, --grep-invert <grep>', `Only run tests that do not match this regular expression`], ['--headed', `Run tests in headed browsers (default: headless)`], ['--ignore-snapshots', `Ignore screenshot and snapshot expectations`], ['--list', `Collect all the tests and report them, but do not run`], ['--max-failures <N>', `Stop after the first N failures`], ['--no-deps', 'Do not run project dependencies'], ['--output <dir>', `Folder for output artifacts (default: "test-results")`], ['--pass-with-no-tests', `Makes test run succeed even if no tests were found`], ['--project <project-name...>', `Only run tests from the specified list of projects (default: run all projects)`], ['--quiet', `Suppress stdio`], ['--repeat-each <N>', `Run each test N times (default: 1)`], ['--reporter <reporter>', `Reporter to use, comma-separated, can be ${_config.builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${_config.defaultReporter}")`], ['--retries <retries>', `Maximum retry count for flaky tests, zero for no retries (default: no retries)`], ['--shard <shard>', `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"`], ['--timeout <timeout>', `Specify test timeout threshold in milliseconds, zero for unlimited (default: ${_config.defaultTimeout})`], ['--trace <mode>', `Force tracing mode, can be ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`], ['--ui', `Run tests in interactive UI mode`], ['-u, --update-snapshots', `Update snapshots with actual results (default: only create missing snapshots)`], ['-j, --workers <workers>', `Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%)`], ['-x', `Stop after the first failure`]];