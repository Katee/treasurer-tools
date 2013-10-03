var path = require('path');
var Q = require('q');
var _ = require('underscore');
var nodemailer = require("nodemailer");
var emailTemplates = require('email-templates');

// put your options in options.js to override these defaults
var options = _.extend({
  email_templates_dir: path.join(__dirname, 'emails')
}, require(path.join(path.dirname(module.filename), 'options')));

var transport = nodemailer.createTransport("SMTP", {
  service: "Gmail",
  auth: {
    user: options.email_username,
    pass: options.email_password
  }
});

var sendReminderEmail = function(email, userInformation) {
  Q.nfcall(emailTemplates, options.email_templates_dir).then(function(template){
    return Q.nfcall(template, 'reminder', userInformation);
  }).then(function(template){
    return Q.nfcall(transport.sendMail, {
      from: options.email_from,
      to: email,
      subject: 'Hacklab Dues Reminder',
      html: template[0],
      text: template[1]
    });
  }).then(function(responseStatus){
    console.log(responseStatus.message);
  }).then(function(){
    console.log('Reminder email sent to %s', email);
  }, function(err){
    console.log(err);
  }).done();
};
