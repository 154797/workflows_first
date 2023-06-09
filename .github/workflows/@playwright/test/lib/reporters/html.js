"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
exports.defaultReportFolder = defaultReportFolder;
exports.showHTMLReport = showHTMLReport;
exports.startHtmlReportServer = startHtmlReportServer;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _fs = _interopRequireDefault(require("fs"));
var _utilsBundle2 = require("../utilsBundle");
var _path = _interopRequireDefault(require("path"));
var _stream = require("stream");
var _utils = require("playwright-core/lib/utils");
var _raw = _interopRequireDefault(require("./raw"));
var _base = require("./base");
var _util = require("../util");
var _zipBundle = require("playwright-core/lib/zipBundle");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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

const kMissingContentType = 'x-playwright/missing';
class HtmlReporter {
  constructor(options) {
    this.config = void 0;
    this.suite = void 0;
    this._montonicStartTime = 0;
    this._options = void 0;
    this._outputFolder = void 0;
    this._attachmentsBaseURL = void 0;
    this._open = void 0;
    this._buildResult = void 0;
    this._options = options;
  }
  printsToStdio() {
    return false;
  }
  onBegin(config, suite) {
    this._montonicStartTime = (0, _utils.monotonicTime)();
    this.config = config;
    const {
      outputFolder,
      open,
      attachmentsBaseURL
    } = this._resolveOptions();
    this._outputFolder = outputFolder;
    this._open = open;
    this._attachmentsBaseURL = attachmentsBaseURL;
    const reportedWarnings = new Set();
    for (const project of config.projects) {
      if (outputFolder.startsWith(project.outputDir) || project.outputDir.startsWith(outputFolder)) {
        const key = outputFolder + '|' + project.outputDir;
        if (reportedWarnings.has(key)) continue;
        reportedWarnings.add(key);
        console.log(_utilsBundle.colors.red(`Configuration Error: HTML reporter output folder clashes with the tests output folder:`));
        console.log(`
    html reporter folder: ${_utilsBundle.colors.bold(outputFolder)}
    test results folder: ${_utilsBundle.colors.bold(project.outputDir)}`);
        console.log('');
        console.log(`HTML reporter will clear its output directory prior to being generated, which will lead to the artifact loss.
`);
      }
    }
    this.suite = suite;
  }
  _resolveOptions() {
    var _ref, _reportFolderFromEnv;
    let {
      outputFolder
    } = this._options;
    if (outputFolder) outputFolder = _path.default.resolve(this._options.configDir, outputFolder);
    return {
      outputFolder: (_ref = (_reportFolderFromEnv = reportFolderFromEnv()) !== null && _reportFolderFromEnv !== void 0 ? _reportFolderFromEnv : outputFolder) !== null && _ref !== void 0 ? _ref : defaultReportFolder(this._options.configDir),
      open: process.env.PW_TEST_HTML_REPORT_OPEN || this._options.open || 'on-failure',
      attachmentsBaseURL: this._options.attachmentsBaseURL || 'data/'
    };
  }
  async onEnd() {
    const duration = (0, _utils.monotonicTime)() - this._montonicStartTime;
    const projectSuites = this.suite.suites;
    const reports = projectSuites.map(suite => {
      const rawReporter = new _raw.default();
      const report = rawReporter.generateProjectReport(this.config, suite);
      return report;
    });
    await (0, _utils.removeFolders)([this._outputFolder]);
    const builder = new HtmlBuilder(this._outputFolder, this._attachmentsBaseURL);
    this._buildResult = await builder.build({
      ...this.config.metadata,
      duration
    }, reports);
  }
  async onExit() {
    if (process.env.CI || !this._buildResult) return;
    const {
      ok,
      singleTestId
    } = this._buildResult;
    const shouldOpen = this._open === 'always' || !ok && this._open === 'on-failure';
    if (shouldOpen) {
      await showHTMLReport(this._outputFolder, this._options.host, this._options.port, singleTestId);
    } else {
      const relativeReportPath = this._outputFolder === standaloneDefaultFolder() ? '' : ' ' + _path.default.relative(process.cwd(), this._outputFolder);
      console.log('');
      console.log('To open last HTML report run:');
      console.log(_utilsBundle.colors.cyan(`
  npx playwright show-report${relativeReportPath}
`));
    }
  }
}
function reportFolderFromEnv() {
  if (process.env[`PLAYWRIGHT_HTML_REPORT`]) return _path.default.resolve(process.cwd(), process.env[`PLAYWRIGHT_HTML_REPORT`]);
  return undefined;
}
function defaultReportFolder(searchForPackageJson) {
  let basePath = (0, _util.getPackageJsonPath)(searchForPackageJson);
  if (basePath) basePath = _path.default.dirname(basePath);else basePath = process.cwd();
  return _path.default.resolve(basePath, 'playwright-report');
}
function standaloneDefaultFolder() {
  var _reportFolderFromEnv2;
  return (_reportFolderFromEnv2 = reportFolderFromEnv()) !== null && _reportFolderFromEnv2 !== void 0 ? _reportFolderFromEnv2 : defaultReportFolder(process.cwd());
}
async function showHTMLReport(reportFolder, host = 'localhost', port, testId) {
  const folder = reportFolder !== null && reportFolder !== void 0 ? reportFolder : standaloneDefaultFolder();
  try {
    (0, _utils.assert)(_fs.default.statSync(folder).isDirectory());
  } catch (e) {
    console.log(_utilsBundle.colors.red(`No report found at "${folder}"`));
    process.exit(1);
    return;
  }
  const server = startHtmlReportServer(folder);
  let url = await server.start({
    port,
    host,
    preferredPort: port ? undefined : 9323
  });
  console.log('');
  console.log(_utilsBundle.colors.cyan(`  Serving HTML report at ${url}. Press Ctrl+C to quit.`));
  if (testId) url += `#?testId=${testId}`;
  await (0, _utilsBundle2.open)(url, {
    wait: true
  }).catch(() => console.log(`Failed to open browser on ${url}`));
  await new Promise(() => {});
}
function startHtmlReportServer(folder) {
  const server = new _utils.HttpServer();
  server.routePrefix('/', (request, response) => {
    let relativePath = new URL('http://localhost' + request.url).pathname;
    if (relativePath.startsWith('/trace/file')) {
      const url = new URL('http://localhost' + request.url);
      try {
        return server.serveFile(request, response, url.searchParams.get('path'));
      } catch (e) {
        return false;
      }
    }
    if (relativePath.endsWith('/stall.js')) return true;
    if (relativePath === '/') relativePath = '/index.html';
    const absolutePath = _path.default.join(folder, ...relativePath.split('/'));
    return server.serveFile(request, response, absolutePath);
  });
  return server;
}
class HtmlBuilder {
  constructor(outputDir, attachmentsBaseURL) {
    this._reportFolder = void 0;
    this._tests = new Map();
    this._testPath = new Map();
    this._dataZipFile = void 0;
    this._hasTraces = false;
    this._attachmentsBaseURL = void 0;
    this._reportFolder = outputDir;
    _fs.default.mkdirSync(this._reportFolder, {
      recursive: true
    });
    this._dataZipFile = new _zipBundle.yazl.ZipFile();
    this._attachmentsBaseURL = attachmentsBaseURL;
  }
  async build(metadata, rawReports) {
    const data = new Map();
    for (const projectJson of rawReports) {
      for (const file of projectJson.suites) {
        const fileName = file.location.file;
        const fileId = file.fileId;
        let fileEntry = data.get(fileId);
        if (!fileEntry) {
          fileEntry = {
            testFile: {
              fileId,
              fileName,
              tests: []
            },
            testFileSummary: {
              fileId,
              fileName,
              tests: [],
              stats: emptyStats()
            }
          };
          data.set(fileId, fileEntry);
        }
        const {
          testFile,
          testFileSummary
        } = fileEntry;
        const testEntries = [];
        this._processJsonSuite(file, fileId, projectJson.project.name, [], testEntries);
        for (const test of testEntries) {
          testFile.tests.push(test.testCase);
          testFileSummary.tests.push(test.testCaseSummary);
        }
      }
    }
    let ok = true;
    for (const [fileId, {
      testFile,
      testFileSummary
    }] of data) {
      const stats = testFileSummary.stats;
      for (const test of testFileSummary.tests) {
        if (test.outcome === 'expected') ++stats.expected;
        if (test.outcome === 'skipped') ++stats.skipped;
        if (test.outcome === 'unexpected') ++stats.unexpected;
        if (test.outcome === 'flaky') ++stats.flaky;
        ++stats.total;
        stats.duration += test.duration;
      }
      stats.ok = stats.unexpected + stats.flaky === 0;
      if (!stats.ok) ok = false;
      const testCaseSummaryComparator = (t1, t2) => {
        const w1 = (t1.outcome === 'unexpected' ? 1000 : 0) + (t1.outcome === 'flaky' ? 1 : 0);
        const w2 = (t2.outcome === 'unexpected' ? 1000 : 0) + (t2.outcome === 'flaky' ? 1 : 0);
        if (w2 - w1) return w2 - w1;
        return t1.location.line - t2.location.line;
      };
      testFileSummary.tests.sort(testCaseSummaryComparator);
      this._addDataFile(fileId + '.json', testFile);
    }
    const htmlReport = {
      metadata,
      files: [...data.values()].map(e => e.testFileSummary),
      projectNames: rawReports.map(r => r.project.name),
      stats: {
        ...[...data.values()].reduce((a, e) => addStats(a, e.testFileSummary.stats), emptyStats()),
        duration: metadata.duration
      }
    };
    htmlReport.files.sort((f1, f2) => {
      const w1 = f1.stats.unexpected * 1000 + f1.stats.flaky;
      const w2 = f2.stats.unexpected * 1000 + f2.stats.flaky;
      return w2 - w1;
    });
    this._addDataFile('report.json', htmlReport);

    // Copy app.
    const appFolder = _path.default.join(require.resolve('playwright-core'), '..', 'lib', 'webpack', 'htmlReport');
    await (0, _utils.copyFileAndMakeWritable)(_path.default.join(appFolder, 'index.html'), _path.default.join(this._reportFolder, 'index.html'));

    // Copy trace viewer.
    if (this._hasTraces) {
      const traceViewerFolder = _path.default.join(require.resolve('playwright-core'), '..', 'lib', 'webpack', 'traceViewer');
      const traceViewerTargetFolder = _path.default.join(this._reportFolder, 'trace');
      const traceViewerAssetsTargetFolder = _path.default.join(traceViewerTargetFolder, 'assets');
      _fs.default.mkdirSync(traceViewerAssetsTargetFolder, {
        recursive: true
      });
      for (const file of _fs.default.readdirSync(traceViewerFolder)) {
        if (file.endsWith('.map') || file.includes('watch') || file.includes('assets')) continue;
        await (0, _utils.copyFileAndMakeWritable)(_path.default.join(traceViewerFolder, file), _path.default.join(traceViewerTargetFolder, file));
      }
      for (const file of _fs.default.readdirSync(_path.default.join(traceViewerFolder, 'assets'))) {
        if (file.endsWith('.map') || file.includes('xtermModule')) continue;
        await (0, _utils.copyFileAndMakeWritable)(_path.default.join(traceViewerFolder, 'assets', file), _path.default.join(traceViewerAssetsTargetFolder, file));
      }
    }

    // Inline report data.
    const indexFile = _path.default.join(this._reportFolder, 'index.html');
    _fs.default.appendFileSync(indexFile, '<script>\nwindow.playwrightReportBase64 = "data:application/zip;base64,');
    await new Promise(f => {
      this._dataZipFile.end(undefined, () => {
        this._dataZipFile.outputStream.pipe(new Base64Encoder()).pipe(_fs.default.createWriteStream(indexFile, {
          flags: 'a'
        })).on('close', f);
      });
    });
    _fs.default.appendFileSync(indexFile, '";</script>');
    let singleTestId;
    if (htmlReport.stats.total === 1) {
      const testFile = data.values().next().value.testFile;
      singleTestId = testFile.tests[0].testId;
    }
    return {
      ok,
      singleTestId
    };
  }
  _addDataFile(fileName, data) {
    this._dataZipFile.addBuffer(Buffer.from(JSON.stringify(data)), fileName);
  }
  _processJsonSuite(suite, fileId, projectName, path, outTests) {
    const newPath = [...path, suite.title];
    suite.suites.map(s => this._processJsonSuite(s, fileId, projectName, newPath, outTests));
    suite.tests.forEach(t => outTests.push(this._createTestEntry(t, projectName, newPath)));
  }
  _createTestEntry(test, projectName, path) {
    const duration = test.results.reduce((a, r) => a + r.duration, 0);
    this._tests.set(test.testId, test);
    const location = test.location;
    path = [...path.slice(1)];
    this._testPath.set(test.testId, path);
    const results = test.results.map(r => this._createTestResult(r));
    return {
      testCase: {
        testId: test.testId,
        title: test.title,
        projectName,
        location,
        duration,
        annotations: test.annotations,
        outcome: test.outcome,
        path,
        results,
        ok: test.outcome === 'expected' || test.outcome === 'flaky'
      },
      testCaseSummary: {
        testId: test.testId,
        title: test.title,
        projectName,
        location,
        duration,
        annotations: test.annotations,
        outcome: test.outcome,
        path,
        ok: test.outcome === 'expected' || test.outcome === 'flaky',
        results: results.map(result => {
          return {
            attachments: result.attachments.map(a => ({
              name: a.name,
              contentType: a.contentType,
              path: a.path
            }))
          };
        })
      }
    };
  }
  _serializeAttachments(attachments) {
    let lastAttachment;
    return attachments.map(a => {
      if (a.name === 'trace') this._hasTraces = true;
      if ((a.name === 'stdout' || a.name === 'stderr') && a.contentType === 'text/plain') {
        if (lastAttachment && lastAttachment.name === a.name && lastAttachment.contentType === a.contentType) {
          lastAttachment.body += (0, _base.stripAnsiEscapes)(a.body);
          return null;
        }
        a.body = (0, _base.stripAnsiEscapes)(a.body);
        lastAttachment = a;
        return a;
      }
      if (a.path) {
        let fileName = a.path;
        try {
          const buffer = _fs.default.readFileSync(a.path);
          const sha1 = (0, _utils.calculateSha1)(buffer) + _path.default.extname(a.path);
          fileName = this._attachmentsBaseURL + sha1;
          _fs.default.mkdirSync(_path.default.join(this._reportFolder, 'data'), {
            recursive: true
          });
          _fs.default.writeFileSync(_path.default.join(this._reportFolder, 'data', sha1), buffer);
        } catch (e) {
          return {
            name: `Missing attachment "${a.name}"`,
            contentType: kMissingContentType,
            body: `Attachment file ${fileName} is missing`
          };
        }
        return {
          name: a.name,
          contentType: a.contentType,
          path: fileName,
          body: a.body
        };
      }
      if (a.body instanceof Buffer) {
        if (isTextContentType(a.contentType)) {
          var _a$contentType$match;
          // Content type is like this: "text/html; charset=UTF-8"
          const charset = (_a$contentType$match = a.contentType.match(/charset=(.*)/)) === null || _a$contentType$match === void 0 ? void 0 : _a$contentType$match[1];
          try {
            const body = a.body.toString(charset || 'utf-8');
            return {
              name: a.name,
              contentType: a.contentType,
              body
            };
          } catch (e) {
            // Invalid encoding, fall through and save to file.
          }
        }
        _fs.default.mkdirSync(_path.default.join(this._reportFolder, 'data'), {
          recursive: true
        });
        const extension = (0, _util.sanitizeForFilePath)(_path.default.extname(a.name).replace(/^\./, '')) || _utilsBundle.mime.getExtension(a.contentType) || 'dat';
        const sha1 = (0, _utils.calculateSha1)(a.body) + '.' + extension;
        _fs.default.writeFileSync(_path.default.join(this._reportFolder, 'data', sha1), a.body);
        return {
          name: a.name,
          contentType: a.contentType,
          path: this._attachmentsBaseURL + sha1
        };
      }

      // string
      return {
        name: a.name,
        contentType: a.contentType,
        body: a.body
      };
    }).filter(Boolean);
  }
  _createTestResult(result) {
    return {
      duration: result.duration,
      startTime: result.startTime,
      retry: result.retry,
      steps: result.steps.map(s => this._createTestStep(s)),
      errors: result.errors,
      status: result.status,
      attachments: this._serializeAttachments(result.attachments)
    };
  }
  _createTestStep(step) {
    return {
      title: step.title,
      startTime: step.startTime,
      duration: step.duration,
      snippet: step.snippet,
      steps: step.steps.map(s => this._createTestStep(s)),
      location: step.location,
      error: step.error,
      count: step.count
    };
  }
}
const emptyStats = () => {
  return {
    total: 0,
    expected: 0,
    unexpected: 0,
    flaky: 0,
    skipped: 0,
    ok: true,
    duration: 0
  };
};
const addStats = (stats, delta) => {
  stats.total += delta.total;
  stats.skipped += delta.skipped;
  stats.expected += delta.expected;
  stats.unexpected += delta.unexpected;
  stats.flaky += delta.flaky;
  stats.ok = stats.ok && delta.ok;
  stats.duration += delta.duration;
  return stats;
};
class Base64Encoder extends _stream.Transform {
  constructor(...args) {
    super(...args);
    this._remainder = void 0;
  }
  _transform(chunk, encoding, callback) {
    if (this._remainder) {
      chunk = Buffer.concat([this._remainder, chunk]);
      this._remainder = undefined;
    }
    const remaining = chunk.length % 3;
    if (remaining) {
      this._remainder = chunk.slice(chunk.length - remaining);
      chunk = chunk.slice(0, chunk.length - remaining);
    }
    chunk = chunk.toString('base64');
    this.push(Buffer.from(chunk));
    callback();
  }
  _flush(callback) {
    if (this._remainder) this.push(Buffer.from(this._remainder.toString('base64')));
    callback();
  }
}
function isTextContentType(contentType) {
  return contentType.startsWith('text/') || contentType.startsWith('application/json');
}
var _default = HtmlReporter;
exports.default = _default;