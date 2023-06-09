"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TestRun = void 0;
exports.createTaskRunner = createTaskRunner;
exports.createTaskRunnerForList = createTaskRunnerForList;
exports.createTaskRunnerForWatch = createTaskRunnerForWatch;
exports.createTaskRunnerForWatchSetup = createTaskRunnerForWatchSetup;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _util = require("util");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _dispatcher = require("./dispatcher");
var _testGroups = require("../runner/testGroups");
var _taskRunner = require("./taskRunner");
var _loadUtils = require("./loadUtils");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const removeFolderAsync = (0, _util.promisify)(_utilsBundle.rimraf);
const readDirAsync = (0, _util.promisify)(_fs.default.readdir);
class TestRun {
  constructor(config, reporter) {
    this.reporter = void 0;
    this.config = void 0;
    this.rootSuite = undefined;
    this.phases = [];
    this.projects = [];
    this.projectFiles = new Map();
    this.projectType = new Map();
    this.projectSuites = new Map();
    this.config = config;
    this.reporter = reporter;
  }
}
exports.TestRun = TestRun;
function createTaskRunner(config, reporter) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, config.config.globalTimeout);
  addGlobalSetupTasks(taskRunner, config);
  taskRunner.addTask('load tests', createLoadTask('in-process', true));
  addRunTasks(taskRunner, config);
  return taskRunner;
}
function createTaskRunnerForWatchSetup(config, reporter) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, 0);
  addGlobalSetupTasks(taskRunner, config);
  return taskRunner;
}
function createTaskRunnerForWatch(config, reporter, additionalFileMatcher) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, 0);
  taskRunner.addTask('load tests', createLoadTask('out-of-process', true, additionalFileMatcher));
  addRunTasks(taskRunner, config);
  return taskRunner;
}
function addGlobalSetupTasks(taskRunner, config) {
  for (const plugin of config.plugins) taskRunner.addTask('plugin setup', createPluginSetupTask(plugin));
  if (config.config.globalSetup || config.config.globalTeardown) taskRunner.addTask('global setup', createGlobalSetupTask());
  taskRunner.addTask('clear output', createRemoveOutputDirsTask());
}
function addRunTasks(taskRunner, config) {
  taskRunner.addTask('create phases', createPhasesTask());
  taskRunner.addTask('report begin', async ({
    reporter,
    rootSuite
  }) => {
    var _reporter$onBegin;
    (_reporter$onBegin = reporter.onBegin) === null || _reporter$onBegin === void 0 ? void 0 : _reporter$onBegin.call(reporter, config.config, rootSuite);
    return () => reporter.onEnd();
  });
  for (const plugin of config.plugins) taskRunner.addTask('plugin begin', createPluginBeginTask(plugin));
  taskRunner.addTask('start workers', createWorkersTask());
  taskRunner.addTask('test suite', createRunTestsTask());
  return taskRunner;
}
function createTaskRunnerForList(config, reporter, mode) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, config.config.globalTimeout);
  taskRunner.addTask('load tests', createLoadTask(mode, false));
  taskRunner.addTask('report begin', async ({
    reporter,
    rootSuite
  }) => {
    var _reporter$onBegin2;
    (_reporter$onBegin2 = reporter.onBegin) === null || _reporter$onBegin2 === void 0 ? void 0 : _reporter$onBegin2.call(reporter, config.config, rootSuite);
    return () => reporter.onEnd();
  });
  return taskRunner;
}
function createPluginSetupTask(plugin) {
  return async ({
    config,
    reporter
  }) => {
    var _plugin$instance, _plugin$instance$setu, _plugin$instance2, _plugin$instance2$bab;
    if (typeof plugin.factory === 'function') plugin.instance = await plugin.factory();else plugin.instance = plugin.factory;
    await ((_plugin$instance = plugin.instance) === null || _plugin$instance === void 0 ? void 0 : (_plugin$instance$setu = _plugin$instance.setup) === null || _plugin$instance$setu === void 0 ? void 0 : _plugin$instance$setu.call(_plugin$instance, config.config, config.configDir, reporter));
    plugin.babelPlugins = (await ((_plugin$instance2 = plugin.instance) === null || _plugin$instance2 === void 0 ? void 0 : (_plugin$instance2$bab = _plugin$instance2.babelPlugins) === null || _plugin$instance2$bab === void 0 ? void 0 : _plugin$instance2$bab.call(_plugin$instance2))) || [];
    return () => {
      var _plugin$instance3, _plugin$instance3$tea;
      return (_plugin$instance3 = plugin.instance) === null || _plugin$instance3 === void 0 ? void 0 : (_plugin$instance3$tea = _plugin$instance3.teardown) === null || _plugin$instance3$tea === void 0 ? void 0 : _plugin$instance3$tea.call(_plugin$instance3);
    };
  };
}
function createPluginBeginTask(plugin) {
  return async ({
    rootSuite
  }) => {
    var _plugin$instance4, _plugin$instance4$beg;
    await ((_plugin$instance4 = plugin.instance) === null || _plugin$instance4 === void 0 ? void 0 : (_plugin$instance4$beg = _plugin$instance4.begin) === null || _plugin$instance4$beg === void 0 ? void 0 : _plugin$instance4$beg.call(_plugin$instance4, rootSuite));
    return () => {
      var _plugin$instance5, _plugin$instance5$end;
      return (_plugin$instance5 = plugin.instance) === null || _plugin$instance5 === void 0 ? void 0 : (_plugin$instance5$end = _plugin$instance5.end) === null || _plugin$instance5$end === void 0 ? void 0 : _plugin$instance5$end.call(_plugin$instance5);
    };
  };
}
function createGlobalSetupTask() {
  return async ({
    config
  }) => {
    const setupHook = config.config.globalSetup ? await (0, _loadUtils.loadGlobalHook)(config, config.config.globalSetup) : undefined;
    const teardownHook = config.config.globalTeardown ? await (0, _loadUtils.loadGlobalHook)(config, config.config.globalTeardown) : undefined;
    const globalSetupResult = setupHook ? await setupHook(config.config) : undefined;
    return async () => {
      if (typeof globalSetupResult === 'function') await globalSetupResult();
      await (teardownHook === null || teardownHook === void 0 ? void 0 : teardownHook(config.config));
    };
  };
}
function createRemoveOutputDirsTask() {
  return async ({
    config
  }) => {
    const outputDirs = new Set();
    for (const p of config.projects) {
      if (!config.cliProjectFilter || config.cliProjectFilter.includes(p.project.name)) outputDirs.add(p.project.outputDir);
    }
    await Promise.all(Array.from(outputDirs).map(outputDir => removeFolderAsync(outputDir).catch(async error => {
      if (error.code === 'EBUSY') {
        // We failed to remove folder, might be due to the whole folder being mounted inside a container:
        //   https://github.com/microsoft/playwright/issues/12106
        // Do a best-effort to remove all files inside of it instead.
        const entries = await readDirAsync(outputDir).catch(e => []);
        await Promise.all(entries.map(entry => removeFolderAsync(_path.default.join(outputDir, entry))));
      } else {
        throw error;
      }
    })));
  };
}
function createLoadTask(mode, shouldFilterOnly, additionalFileMatcher) {
  return async (testRun, errors) => {
    await (0, _loadUtils.collectProjectsAndTestFiles)(testRun, additionalFileMatcher);
    await (0, _loadUtils.loadFileSuites)(testRun, mode, errors);
    testRun.rootSuite = await (0, _loadUtils.createRootSuite)(testRun, errors, shouldFilterOnly);
    // Fail when no tests.
    if (!testRun.rootSuite.allTests().length && !testRun.config.cliPassWithNoTests && !testRun.config.config.shard) throw new Error(`No tests found`);
  };
}
function createPhasesTask() {
  return async testRun => {
    let maxConcurrentTestGroups = 0;
    const processed = new Set();
    const projectToSuite = new Map(testRun.rootSuite.suites.map(suite => [suite._fullProject, suite]));
    for (let i = 0; i < projectToSuite.size; i++) {
      // Find all projects that have all their dependencies processed by previous phases.
      const phaseProjects = [];
      for (const project of projectToSuite.keys()) {
        if (processed.has(project)) continue;
        if (project.deps.find(p => !processed.has(p))) continue;
        phaseProjects.push(project);
      }

      // Create a new phase.
      for (const project of phaseProjects) processed.add(project);
      if (phaseProjects.length) {
        let testGroupsInPhase = 0;
        const phase = {
          dispatcher: new _dispatcher.Dispatcher(testRun.config, testRun.reporter),
          projects: []
        };
        testRun.phases.push(phase);
        for (const project of phaseProjects) {
          const projectSuite = projectToSuite.get(project);
          const testGroups = (0, _testGroups.createTestGroups)(projectSuite, testRun.config.config.workers);
          phase.projects.push({
            project,
            projectSuite,
            testGroups
          });
          testGroupsInPhase += testGroups.length;
        }
        (0, _utilsBundle.debug)('pw:test:task')(`created phase #${testRun.phases.length} with ${phase.projects.map(p => p.project.project.name).sort()} projects, ${testGroupsInPhase} testGroups`);
        maxConcurrentTestGroups = Math.max(maxConcurrentTestGroups, testGroupsInPhase);
      }
    }
    testRun.config.config.workers = Math.min(testRun.config.config.workers, maxConcurrentTestGroups);
  };
}
function createWorkersTask() {
  return async ({
    phases
  }) => {
    return async () => {
      for (const {
        dispatcher
      } of phases.reverse()) await dispatcher.stop();
    };
  };
}
function createRunTestsTask() {
  return async testRun => {
    const {
      phases
    } = testRun;
    const successfulProjects = new Set();
    const extraEnvByProjectId = new Map();
    for (const {
      dispatcher,
      projects
    } of phases) {
      // Each phase contains dispatcher and a set of test groups.
      // We don't want to run the test groups beloning to the projects
      // that depend on the projects that failed previously.
      const phaseTestGroups = [];
      for (const {
        project,
        testGroups
      } of projects) {
        // Inherit extra enviroment variables from dependencies.
        let extraEnv = {};
        for (const dep of project.deps) extraEnv = {
          ...extraEnv,
          ...extraEnvByProjectId.get(dep.id)
        };
        extraEnvByProjectId.set(project.id, extraEnv);
        const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
        if (!hasFailedDeps) {
          phaseTestGroups.push(...testGroups);
        } else {
          for (const testGroup of testGroups) {
            for (const test of testGroup.tests) test._appendTestResult().status = 'skipped';
          }
        }
      }
      if (phaseTestGroups.length) {
        await dispatcher.run(phaseTestGroups, extraEnvByProjectId);
        await dispatcher.stop();
        for (const [projectId, envProduced] of dispatcher.producedEnvByProjectId()) {
          const extraEnv = extraEnvByProjectId.get(projectId) || {};
          extraEnvByProjectId.set(projectId, {
            ...extraEnv,
            ...envProduced
          });
        }
      }

      // If the worker broke, fail everything, we have no way of knowing which
      // projects failed.
      if (!dispatcher.hasWorkerErrors()) {
        for (const {
          project,
          projectSuite
        } of projects) {
          const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
          if (!hasFailedDeps && !projectSuite.allTests().some(test => !test.ok())) successfulProjects.add(project);
        }
      }
    }
  };
}