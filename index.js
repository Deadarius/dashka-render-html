'use strict';

var Promise = require('bluebird');
var _ = require('lodash');
var path = require('path');
var fs = Promise.promisifyAll(require('fs'));
var Handlebars = require('handlebars');
var sass = Promise.promisifyAll(require('node-sass'));

module.exports = {
  compile: function compile(options, context, compileCallback){
    var defaultOpts = {
      size: {
        height: 1,
        width: 2
      }
    };
    var templatePath = path.join(__dirname, 'content/layout.handlebars');
    var scssPath = path.join(__dirname, 'content/site.scss');
    function run(callback){
      var renderPromises = context.getAllComponents()
        .filter(function(component){
          return component.$controllerName.startsWith('dashka-htmlwidget');
        })
        .map(function(component){
          var widgetOpts = options.widgets[component.$name] || {};
          widgetOpts = _.extend(defaultOpts, widgetOpts);
          var widget = {
            title: component.title
          };

          if(typeof widgetOpts.size === 'string'){
            var sizeSplit = widgetOpts.size.split('x');
            widget.size = {
              height: +sizeSplit[0],
              width: +sizeSplit[1]
            };
          } else {
            widget.size = widgetOpts.size;
          }

          return Promise.promisify(component.render).bind(component)()
            .then(function(html){
              return {
                title: component.title,
                html: html
              };
            });
        });

      Promise.all(renderPromises)
        .then(function(widgets){
          var data = {
            widgets: widgets
          };
          fs.read(templatePath)
            .then(function(templateText){
              var template = Handlebars.compile(templateText);
              var renderedPage = template(data);
              var indexPath = path.join(context.config.renderFolder, 'index.html');
              return fs.writeFile(indexPath, renderedPage);
            })
            .then(function() {
              return sass.render({ file: scssPath });
            })
            .then(function(renderedScss) {
              var cssPath = path.join(context.config.renderFolder, 'site.css');
              return fs.writeFile(cssPath, renderedScss);
            })
            .then(function(){
              callback();
            });
        });
      }
      compileCallback(null, {
        run: run
      });
  }
};
