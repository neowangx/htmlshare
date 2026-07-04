#!/usr/bin/env node

import { run } from "../src/cli/publish.js";

process.exitCode = await run(process.argv.slice(2));
