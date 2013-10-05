var Q = require('q');
var nodemailer = require("nodemailer");
var emailTemplates = require('email-templates');

var sendReminderEmail = function(email, userInformation, paymentsInformation, options) {
  sendEmail(email, {user: userInformation, payments: paymentsInformation}, 'Hacklab Dues Reminder', 'reminder', options);
};

var sendReceiptEmail = function(email, userInformation, paymentInformation, payments, options) {
  sendEmail(email, {user: userInformation, payment: paymentInformation, payments: payments}, 'Hacklab Dues Receipt', 'receipt', options);
};

module.exports.sendReminderEmail = sendReminderEmail;
module.exports.sendReceiptEmail = sendReceiptEmail;

function sendEmail(email, templateData, subject, templateName, options) {
  var transport = makeTransport(options);

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
    transport.close();
  }, function(err){
    console.log(err);
  }).done();
}

function makeTransport(options) {
  return nodemailer.createTransport("SMTP", {
    service: "Gmail",
    auth: {
      user: options.email_username,
      pass: options.email_password
    }
  });
}
