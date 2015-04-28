/**
 * Project manipulation utilities. Installs the dependencies defined in the project.json file.
 *
 * @package engine\utils
 * @author Valentin Duricu (valentin (at) duricu.ro)
 * @date 20.04.2015
 * @module utils/project_utils
 */
"use strict";

var unirest = require('unirest'),
    OmenAPI = require('./omen_api'),
    fs = require('fs'),
    path = require('path'),
    fstream = require('fstream'),
    tar = require('tar'),
    zlib = require('zlib'),
    Download = require('download'),
    Q = require("q");

/**
 * Project manipulation utilities.
 *
 * @class
 */
var ProjectUtils = {};

/**
 * Checks if the given variable is valid or not.
 *
 * @param {Object} value The variable to be checked.
 * @return Boolean
 */
var _isValid = function (value) {
    return value !== undefined && value !== null;
};

/**
 * For a given project builds the dependencies list that is sent to the server.
 *
 * @param {Project} project The project for which the dependencies are being built.
 * @return Array
 */
ProjectUtils.buildDependencies = function (project) {
    var versionPattern = new RegExp("^(<|>|<=|>=)?([0-9]+).((\\*|[0-9]+)(\.([0-9]+|\\*))?)$", "i"),
        returnDeps = [],
        dependencies = project.get('dependencies'),
        i = 0;

    if (!_isValid(dependencies))
        return returnDeps;


    for (var iElem in dependencies) {
        var app = iElem,
            verArr = versionPattern.exec(dependencies[iElem]),
            version = {};

        version.operator = verArr[1];
        if (!_isValid(version.operator))
            version.operator = "=";

        version.major = verArr[2];
        version.minor = verArr[4];
        version.patch = verArr[6];

        if (!_isValid(version.minor))
            version.minor = "0";
        else if (version.minor == "*")
            version.like = true;

        if (!_isValid(version.patch))
            version.patch = "0";
        else if (version.patch == "*")
            version.like = true;

        returnDeps.push({
            package: app,
            version: version
        });
    }

    return returnDeps;
};

/**
 * Performs a check of the dependencies on the server.
 *
 * @param {Array} dependencies The dependencies to be checked.
 * @return Promise
 */
ProjectUtils.checkDependencies = function (dependencies) {
    var deferred = Q.defer();

    /* The check of the dependencies is being done on the server. */
    unirest.post(OmenAPI.buildURL('/dependency/check'))
        .type('json')
        .send({deps: dependencies})
        .end(function (response) {
            if (response.statusType == 4 || response.statusType == 5)
                deferred.reject(new Error({status: response.status, body: response.body}));
            else
                deferred.resolve(response.body);
        });

    return deferred.promise;
};

/**
 * For the given dependencies, download them and store them locally.
 *
 * @param {Array} dependencies The dependencies to be downloaded.
 * @return Promise
 */
ProjectUtils.downloadDependencies = function (dependencies) {
    var downloads = Download({mode: '755'}).dest('./vendor'),
        deferred = Q.defer();

    /* Build the download list. */
    for (var i in dependencies) {
        downloads.get(dependencies[i]);
    }

    /* Downloads the files. */
    downloads.run(function (err, files) {
        if (err != null && err != undefined) {
            deferred.reject(new Error(err));
            return;
        }

        deferred.resolve(files);
    });

    return deferred.promise;
};

/**
 * Publishes the local package to the system defined repository.
 *
 * @param {Project} project The information about the current package.
 * @param {Object} promptResult The password and other questions asked by the application.
 * @return Promise
 */
ProjectUtils.publish = function (project, promptResult) {
    var deferred, lines, data, fullPath;

    deferred = Q.defer();
    lines = [];
    fullPath = path.resolve('.');

    /* Try to read the file with ignore elements. */
    try {
        data = fs.readFileSync('.omenignore', "utf-8");
        lines = data.split(/\n/);
    } catch (err) {

    }

    /**
     * Create the package that will be sent to the repository.
     * We will create a .tar.gz2 file with .spk extension.
     * */
    var writer = fstream.Writer({'path': 'omenpackage.spk'});
    fstream.Reader({
        'path': '.',
        'type': 'Directory',
        filter: function () {
            var file = this.path.substring(fullPath.length);

            /* Filter some standard files to not be included in the package. */
            if (this.basename.match(/^\.git/) ||
                this.basename.match(/^vendors/) ||
                this.basename.match(/^omenpackage.spk/) ||
                this.basename.match(/^node_modules/))
                return false;

            /* Filter the files specified in .omenignore file. */
            for (var iLine in lines) {
                var line = lines[iLine].trim();

                if (this.basename.match(new RegExp(line)))
                    return false;

                if (file.match(new RegExp(line)))
                    return false;
            }

            return true;
        }
    })
        .pipe(tar.Pack())/* Convert the directory to a .tar file */
        .pipe(zlib.Gzip())/* Compress the .tar file */
        .pipe(writer);

    /* When the archive has been written to the fs, send it to the repository. */
    writer.on("close", function () {
        unirest.post(OmenAPI.buildURL('/publish/project'))
            .headers({'Accept': 'application/json'})
            .attach('file', './omenpackage.spk') // Attachment
            .field("omenFile", project.all())
            .field("user", project.get('author').email)
            .field("pass", promptResult.Password)
            .end(function (response) {
                //console.log(response.body);
                if (response.statusType == 4 || response.statusType == 5)
                    deferred.reject(new Error({status: response.status, body: response.body}));
                else
                    deferred.resolve(response.body);
            });
    });


    return deferred.promise;
};

module.exports = ProjectUtils;