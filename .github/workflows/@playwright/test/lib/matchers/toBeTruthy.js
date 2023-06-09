"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toBeTruthy = toBeTruthy;
var _util = require("../util");
var _matcherHint = require("./matcherHint");
var _globals = require("../common/globals");
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

async function toBeTruthy(matcherName, receiver, receiverType, query, options = {}) {
  (0, _util.expectTypes)(receiver, [receiverType], matcherName);
  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise
  };
  const timeout = (0, _globals.currentExpectTimeout)(options);
  const {
    matches,
    log,
    timedOut
  } = await query(this.isNot, timeout);
  const message = () => {
    return (0, _matcherHint.matcherHint)(this, matcherName, undefined, '', matcherOptions, timedOut ? timeout : undefined) + (0, _util.callLogText)(log);
  };
  return {
    message,
    pass: matches
  };
}