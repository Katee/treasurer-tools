var path = require('path');
var Q = require('q');
var _ = require('underscore');

// put your options in options.js to override these defaults
var options = _.extend({
  email_templates_dir: path.join(__dirname, 'emails')
}, require(path.join(path.dirname(module.filename), 'options')));

var emailer = require(path.join(path.dirname(module.filename), 'emailer'));
