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
  sendEmail(email, userInformation, 'Hacklab Dues Reminder', 'reminder');
};

var sendPaymentReceiptEmail = function(email, userInformation, paymentInformation) {
  sendEmail(email, {user: userInformation, payment: paymentInformation}, 'Hacklab Dues Receipt', 'receipt');
};

var sendEmail = function(email, templateData, subject, templateName) {
  Q.nfcall(emailTemplates, options.email_templates_dir).then(function(template){
    return Q.nfcall(template, templateName, templateData);
  }).then(function(template){
    return Q.nfcall(transport.sendMail, {
      from: options.email_from,
      to: email,
      subject: subject,
      html: template[0],
      text: template[1]
    });
  }).then(function(responseStatus){
    console.log(responseStatus.message);
  }).then(function(){
    console.log('%s sent to %s', subject, email);
  }, function(err){
    console.log(err);
  }).done();
};
