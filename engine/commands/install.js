/**
 * Installs the dependencies defined in the project.json file.
 *
 * @package engine\commands
 * @author Valentin Duricu (valentin (at) duricu.ro)
 * @date 16.04.2015
 * @module commands/install
 */
"use strict";

var Project = require('././project'),
    ProjectUtils = require('./../utils/project_utils'),
    Spark = require('./../base/spark'),
    CommandOmen = require('./../base/command'),
    Decompress = require("decompress"),
    fs = require("fs"),
    path = require("path");

/**
 * Writes the omen lock file - used for the update command.
 *
 * @param {Object} omenLock The properties to be written in the lock file.
 */
var _omenLockWrite = function (omenLock) {
    self.cli().ok("Writing omen.lock file...");
    fs.writeFile(path.resolve("./omen.lock"), JSON.stringify(omenLock, null, 4));
};

var InstallOmen;

/**
 * Install command constructor.
 *
 * @class
 */
InstallOmen = function () {
};

/**
 * Attach the super class.
 *
 * @var CommandOmen
 */
InstallOmen.prototype = new CommandOmen();

/**
 * Code that runs when a command is executed.
 *
 * @param {String} filename The name of the file to be installed.
 */
InstallOmen.prototype.run = function (filename) {
    this.cli().ok('====================================================');
    this.cli().ok('    Omen (' + Spark.version() + ') - Project installation:');
    this.cli().ok('----------------------------------------------------');
    this.cli().info("Reading project information");

    var project = new Project(filename),
        self = this;

    this.cli().info("Checking project file");
    project.check();

    this.cli().info("Building dependencies");
    var deps = ProjectUtils.buildDependencies(project);

    this.cli().info("Checking dependencies");

    var omenLock = {};
    omenLock.file = project.getFilename();
    omenLock.packages = {};

    if (deps.length == 0) {
        return _omenLockWrite(omenLock);
    }

    ProjectUtils.checkDependencies(deps).then(function (res) {

        /* If there is an error, then notify the developer about it and end the execution. */
        if (res.status == "error") {
            self.cli().error("There were some errors:");
            for (var errorLine in res.errors) {
                var line = res.errors[errorLine];
                if (line.available != null && line.available != undefined)
                    self.cli().error("   - " + errorLine + ": " + line.message + " (Available: " + line.available + ")");
                else
                    self.cli().error("   - " + errorLine + ": " + line.message);
            }

            return;
        }

        /* Check the existence of the vendors folder and create if it doesn't.*/
        if (!fs.existsSync("./vendors"))
            fs.mkdirSync("./vendors");

        if (res.dependencies != null && res.dependencies != undefined) {
            self.cli().info("Downloading files");

            /* Download the dependencies. */
            ProjectUtils.downloadDependencies(res.dependencies).then(function (files) {
                    var fullPath = path.resolve('./vendors/');

                    /* Store the received dependencies in the lock object. */
                    for (var i in res.packages) {
                        omenLock.packages[res.packages[i].package] = res.packages[i].version;
                    }

                    /* Store the lock object*/
                    _omenLockWrite(omenLock);

                    /* Decompress each of the received files. */
                    for (var i in files) {
                        Decompress({mode: '755'})
                            .src(files[i].path)
                            .dest(fullPath)
                            .use(Decompress.targz({strip: 1}))
                            .run(function (err, archFiles) {
                                var pack = res.packages[files[i].path.substring(fullPath.length + 1)];

                                if (err) {
                                    self.cli().error("Problems installing: " + pack.package + " (version: " + pack.version + ") - ");
                                    self.cli().error(err);
                                    return;
                                }

                                self.cli().ok("Package: " + pack.package + " (version: " + pack.version + ") - Installed");
                            });
                    }
                },
                function (err) {
                    /* In case an error is received, display it. */
                    self.cli().error(err.message);
                    self.cli().ok('====================================================');
                });
        }
        else
            _omenLockWrite(omenLock);

    }, function (err) {
        /* In case an error is received, display it. */
        console.log(JSON.stringify(err.message.body));
        self.cli().error("Got HTTP: " + err.message.status);
        self.cli().ok('====================================================');
    });


};


module.exports = InstallOmen;