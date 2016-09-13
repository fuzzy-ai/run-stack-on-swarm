#!/usr/bin/env node
// Run a Docker Cloud stack file on a Docker 1.12 or higher swarm

const fs = require('fs');
const yaml = require('js-yaml');

var doc = null;

// Get document, or throw exception on error
try {
  doc = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
} catch (e) {
  console.error(e);
  process.exit(-1);
}

var network;

if (process.argv.length > 3) {
  network = process.argv[3];
}

console.log("#!/bin/sh");

var addOption = (options, key, value) => {
  if (options[key]) {
    options[key].push(value);
  } else {
    options[key] = [value];
  }
  return options;
};

var toEnvStr = (key, str) => {
  let envstr = null;
  if (typeof(str) == "string" && str.match(/\s+/)) {
    if (str.indexOf('"') !== -1) {
      envstr = `'${key}=${str}'`;
    } else {
      envstr = `"${key}=${str}"`;
    }
  } else {
    envstr = `${key}=${str}`;
  }
  return envstr;
};

for (name in doc) {

  let service = doc[name];

  let options = {"name": [name]},
    image = null,
    command = null;

  if (network) {
    addOption(options, "network", network);
  }

  for (key in service) {
    let value = service[key];
    switch (key) {
      case "image":
        image = value;
        break;
      case "command":
        command = value;
        break;
      case "volumes":
        process.stderr.write(`WARN: ignoring volumes for ${name}\n`);
        break;
      case "volumes_from":
        process.stderr.write(`WARN: ignoring volumes for ${name}\n`);
        break;
      case "tags":
        for (j in value) {
//          addOption(options, "constraint", `node.label.${value[j]}==${value[j]}`);
        }
        break;
      case "ports":
        for (j in value) {
          addOption(options, "publish", value[j]);
        }
        break;
      case "environment":
        if (Array.isArray(value)) {
          for (j in value) {
            let parts = value[j].split("=", 2);
            let str = toEnvStr(parts[0], parts[1]);
            addOption(options, "env", str);
          }
        } else {
          for (key in value) {
            let str = toEnvStr(key, value[key]);
            addOption(options, "env", str);
          }
        }
        break;
      case "restart":
        addOption(options, "restart-condition", value);
        break;
      case "target_num_containers":
        addOption(options, "replicas", value);
        break;
      case "sequential_deployment":
        addOption(options, "update-parallelism", "2");
        addOption(options, "update-delay", "10s");
        break;
      default:
        process.stderr.write(`WARN: ignoring unknown option ${key} for ${name}\n`);
        break;
    }
  }

  var optstrs = [];

  for (key in options) {
    let values = options[key];
    for (i in values) {
      let value = values[i];
      optstrs.push(`--${key} ${value}`);
    }
  }

  var cmd = "docker service create \\\n  ";

  cmd += optstrs.join(" \\\n  ");

  cmd += ` \\\n  ${image}`;

  if (command) {
    cmd += ` \\\n  ${command}`;
  }

  cmd += "\n\n";

  console.log(cmd);
}
