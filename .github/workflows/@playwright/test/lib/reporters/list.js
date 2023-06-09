"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _base = require("./base");
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

/* eslint-disable no-console */

// Allow it in the Visual Studio Code Terminal and the new Windows Terminal
const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x' : '✘';
class ListReporter extends _base.BaseReporter {
  constructor(options = {}) {
    super(options);
    this._lastRow = 0;
    this._lastColumn = 0;
    this._testRows = new Map();
    this._stepRows = new Map();
    this._resultIndex = new Map();
    this._stepIndex = new Map();
    this._needNewLine = false;
    this._liveTerminal = void 0;
    this._printSteps = void 0;
    this._printSteps = options.printSteps || !!process.env.PW_TEST_DEBUG_REPORTERS_PRINT_STEPS;
    this._liveTerminal = process.stdout.isTTY || !!process.env.PWTEST_TTY_WIDTH;
  }
  printsToStdio() {
    return true;
  }
  onBegin(config, suite) {
    super.onBegin(config, suite);
    const startingMessage = this.generateStartingMessage();
    if (startingMessage) {
      console.log(startingMessage);
      console.log();
    }
  }
  onTestBegin(test, result) {
    if (this._liveTerminal) this._maybeWriteNewLine();
    this._resultIndex.set(result, String(this._resultIndex.size + 1));
    if (this._liveTerminal) {
      this._testRows.set(test, this._lastRow);
      const index = this._resultIndex.get(result);
      const prefix = this._testPrefix(index, '');
      const line = _utilsBundle.colors.dim((0, _base.formatTestTitle)(this.config, test)) + this._retrySuffix(result);
      this._appendLine(line, prefix);
    }
  }
  onStdOut(chunk, test, result) {
    super.onStdOut(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stdout);
  }
  onStdErr(chunk, test, result) {
    super.onStdErr(chunk, test, result);
    this._dumpToStdio(test, chunk, process.stderr);
  }
  onStepBegin(test, result, step) {
    if (step.category !== 'test.step') return;
    const testIndex = this._resultIndex.get(result);
    if (!this._printSteps) {
      if (this._liveTerminal) this._updateLine(this._testRows.get(test), _utilsBundle.colors.dim((0, _base.formatTestTitle)(this.config, test, step)) + this._retrySuffix(result), this._testPrefix(testIndex, ''));
      return;
    }
    const ordinal = (result[lastStepOrdinalSymbol] || 0) + 1;
    result[lastStepOrdinalSymbol] = ordinal;
    const stepIndex = `${testIndex}.${ordinal}`;
    this._stepIndex.set(step, stepIndex);
    if (this._liveTerminal) this._maybeWriteNewLine();
    if (this._liveTerminal) {
      this._stepRows.set(step, this._lastRow);
      const prefix = this._testPrefix(stepIndex, '');
      const line = test.title + _utilsBundle.colors.dim((0, _base.stepSuffix)(step));
      this._appendLine(line, prefix);
    }
  }
  onStepEnd(test, result, step) {
    if (step.category !== 'test.step') return;
    const testIndex = this._resultIndex.get(result);
    if (!this._printSteps) {
      if (this._liveTerminal) this._updateLine(this._testRows.get(test), _utilsBundle.colors.dim((0, _base.formatTestTitle)(this.config, test, step.parent)) + this._retrySuffix(result), this._testPrefix(testIndex, ''));
      return;
    }
    const index = this._stepIndex.get(step);
    const title = test.title + _utilsBundle.colors.dim((0, _base.stepSuffix)(step));
    const prefix = this._testPrefix(index, '');
    let text = '';
    if (step.error) text = _utilsBundle.colors.red(title);else text = title;
    text += _utilsBundle.colors.dim(` (${(0, _utilsBundle.ms)(step.duration)})`);
    this._updateOrAppendLine(this._stepRows.get(step), text, prefix);
  }
  _maybeWriteNewLine() {
    if (this._needNewLine) {
      this._needNewLine = false;
      process.stdout.write('\n');
    }
  }
  _updateLineCountAndNewLineFlagForOutput(text) {
    this._needNewLine = text[text.length - 1] !== '\n';
    const ttyWidth = this.ttyWidth();
    if (!this._liveTerminal || ttyWidth === 0) return;
    for (const ch of text) {
      if (ch === '\n') {
        this._lastColumn = 0;
        ++this._lastRow;
        continue;
      }
      ++this._lastColumn;
      if (this._lastColumn > ttyWidth) {
        this._lastColumn = 0;
        ++this._lastRow;
      }
    }
  }
  _dumpToStdio(test, chunk, stream) {
    if (this.config.quiet) return;
    const text = chunk.toString('utf-8');
    this._updateLineCountAndNewLineFlagForOutput(text);
    stream.write(chunk);
  }
  onTestEnd(test, result) {
    super.onTestEnd(test, result);
    const title = (0, _base.formatTestTitle)(this.config, test);
    let prefix = '';
    let text = '';
    const index = this._resultIndex.get(result);
    if (result.status === 'skipped') {
      prefix = this._testPrefix(index, _utilsBundle.colors.green('-'));
      // Do not show duration for skipped.
      text = _utilsBundle.colors.cyan(title) + this._retrySuffix(result);
    } else {
      const statusMark = result.status === 'passed' ? POSITIVE_STATUS_MARK : NEGATIVE_STATUS_MARK;
      if (result.status === test.expectedStatus) {
        prefix = this._testPrefix(index, _utilsBundle.colors.green(statusMark));
        text = title;
      } else {
        prefix = this._testPrefix(index, _utilsBundle.colors.red(statusMark));
        text = _utilsBundle.colors.red(title);
      }
      text += this._retrySuffix(result) + _utilsBundle.colors.dim(` (${(0, _utilsBundle.ms)(result.duration)})`);
    }
    this._updateOrAppendLine(this._testRows.get(test), text, prefix);
  }
  _updateOrAppendLine(row, text, prefix) {
    if (this._liveTerminal) {
      this._updateLine(row, text, prefix);
    } else {
      this._maybeWriteNewLine();
      this._appendLine(text, prefix);
    }
  }
  _appendLine(text, prefix) {
    const line = prefix + this.fitToScreen(text, prefix);
    if (process.env.PW_TEST_DEBUG_REPORTERS) {
      process.stdout.write(this._lastRow + ' : ' + line + '\n');
    } else {
      process.stdout.write(line);
      process.stdout.write('\n');
    }
    ++this._lastRow;
  }
  _updateLine(row, text, prefix) {
    const line = prefix + this.fitToScreen(text, prefix);
    if (process.env.PW_TEST_DEBUG_REPORTERS) process.stdout.write(row + ' : ' + line + '\n');else this._updateLineForTTY(row, line);
  }
  _updateLineForTTY(row, line) {
    // Go up if needed
    if (row !== this._lastRow) process.stdout.write(`\u001B[${this._lastRow - row}A`);
    // Erase line, go to the start
    process.stdout.write('\u001B[2K\u001B[0G');
    process.stdout.write(line);
    // Go down if needed.
    if (row !== this._lastRow) process.stdout.write(`\u001B[${this._lastRow - row}E`);
    if (process.env.PWTEST_TTY_WIDTH) process.stdout.write('\n'); // For testing.
  }

  _testPrefix(index, statusMark) {
    const statusMarkLength = (0, _base.stripAnsiEscapes)(statusMark).length;
    return '  ' + statusMark + ' '.repeat(3 - statusMarkLength) + _utilsBundle.colors.dim(index + ' ');
  }
  _retrySuffix(result) {
    return result.retry ? _utilsBundle.colors.yellow(` (retry #${result.retry})`) : '';
  }
  onError(error) {
    super.onError(error);
    this._maybeWriteNewLine();
    const message = (0, _base.formatError)(this.config, error, _utilsBundle.colors.enabled).message + '\n';
    this._updateLineCountAndNewLineFlagForOutput(message);
    process.stdout.write(message);
  }
  async onEnd(result) {
    await super.onEnd(result);
    process.stdout.write('\n');
    this.epilogue(true);
  }
}
const lastStepOrdinalSymbol = Symbol('lastStepOrdinal');
var _default = ListReporter;
exports.default = _default;