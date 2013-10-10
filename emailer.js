var Q = require('q');
var nodemailer = require("nodemailer");
var emailTemplates = require('email-templates');

var sendReminderEmail = function(email, userInformation, paymentsInformation, options) {
  return sendEmail(email, {user: userInformation, payments: paymentsInformation}, 'Hacklab Dues Reminder', 'reminder', options);
};

var sendReceiptEmail = function(email, userInformation, paymentInformation, payments, options) {
  return sendEmail(email, {user: userInformation, payment: paymentInformation, payments: payments}, 'Hacklab Dues Receipt', 'receipt', options);
};

module.exports.sendReminderEmail = sendReminderEmail;
module.exports.sendReceiptEmail = sendReceiptEmail;

function sendEmail(email, templateData, subject, templateName, options, callback) {
  var transport = makeTransport(options);
  var deferred = Q.defer();

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
    deferred.resolve({subject: subject, email: email});
    transport.close();
  }).catch(function(err){
    console.log(err);
    deferred.reject(err);
  }).done();

  return deferred.promise;
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
