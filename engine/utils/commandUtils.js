/**
 * Command execution utilities.
 *
 * @package engine\utils
 * @author Valentin Duricu (valentin@duricu.ro)
 * @date 17.04.2015
 * @module utils
 */
/*jslint node: true */
"use strict";

var _cli = null,
    _filename = "project.json",
    CommandUtils;

/**
 * Command execution utilities.
 *
 * @class
 */
CommandUtils = {};

/**
 * Executes a command sent in the CLI.
 *
 * @param {String} command The command to be executed.
 * @return CommandOmen
 */
CommandUtils.CommandExecutor = function (command) {
    if (command === null || command === undefined)
        return _cli.getUsage();

    try {
        var ClassCmd = require('./../commands/' + command + '.js');

        if (ClassCmd === null || ClassCmd === undefined)
            return _cli.getUsage();

        var cmd = new ClassCmd();
        cmd.init(_cli, _filename);
        return cmd;
    } catch (e) {
        return _cli.getUsage();
    }
};

/**
 * Initializes some variables used by the CommandExecutor function.
 *
 * @param {CliListenerOmen} cli The reference to cli library.
 * @param {String} filename The filename.
 */
CommandUtils.SetInit = function (cli, filename) {
    _cli = cli;
    _filename = filename;
};

module.exports = CommandUtils;