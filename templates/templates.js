/**
 * Templates to be used by the template command.
 *
 * @package templates
 * @author valentin.duricu
 * @date 07.06.2015
 * @module templates
 */
/*jslint node: true */
"use strict";

var Spark = require('./../engine/base/spark'),
    OmenAPI = require('./../engine/utils/omen_api'),
    Handlebars = require('handlebars'),
    fs = require('fs'),
    path = require('path');

var templates = {
    sample: {
        filename: "sample.hbs",
        extension: ".p"
    }
};

var varsToCompile = {
    propath: OmenAPI.propath(),
    name: "",
    filename: "",
    version: Spark.version()
};

var templateRun = function(filename, cli){
    var template = templates[filename];
    if(template === null || template === undefined)
        return cli.error("The required template [" + filename + "} doesn't exists!");

    var fullFilename = path.resolve(__dirname + '/' + template.filename);

    fs.exists(fullFilename, function (exists) {
        if (!exists)
            return cli.error("The required template [" + filename + "} is missing!");

        var templateFile = fs.readFileSync(fullFilename, "utf-8");
        var templateHbs = Handlebars.compile(templateFile, {noEscape: true});
        varsToCompile.name = filename;
        varsToCompile.filename = filename + template.extension;

        var output = templateHbs(varsToCompile);

        fs.writeFileSync(path.resolve(varsToCompile.filename), output, "utf-8");

        varsToCompile.name = "";
        varsToCompile.filename = "";

        cli.ok('====================================================');
        cli.ok('    Omen (' + Spark.version() + ') - Generate sample files from templates:');
        cli.ok('----------------------------------------------------');
        cli.ok(' File [' + filename + '] has been created.');
        cli.ok('====================================================');
    });
};

module.exports = templateRun;