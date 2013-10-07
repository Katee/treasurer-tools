var path = require('path');
var Q = require('q');
var _ = require('underscore');
var util = require('util');
var fs = require('fs');
require('date-format-lite');

// put your options in options.js to override these defaults
var options = _.extend({
  date_format: "YYYY-MM-DD",
  email_templates_dir: path.join(__dirname, 'emails'),
  payments_file: path.join(__dirname, 'data', 'payments.csv'),
  users_file: path.join(__dirname, 'data', 'users.csv'),
  email_log: path.join(__dirname, 'data', 'emails.log')
}, require(path.join(path.dirname(module.filename), 'options')));

var email_log = fs.createWriteStream(options.email_log, {'flags': 'a'});

var emailer = require(path.join(path.dirname(module.filename), 'emailer'));

var models = require(path.join(path.dirname(module.filename), 'models'));
var Payment = models.Payment;
var User = models.User;

var payments = [];
var users = [];

process.stdin.resume();
process.stdin.setEncoding('utf8');

console.log('Welcome to Treasurer tools');
// automatically load the payments and users on start
loadPayments().then(function(value){
  payments = value;
});
loadUsers().then(function(value){
  users = value;
});

process.stdin.on('data', function (text) {
  var emailCommandRegex = /^email (reminder|receipt|.+) ([a-zA-Z ]+)/;
  var paymentRegex = /^payment (add) (".+") (\$[0-9]+\.[0-9]{2}) (cash|cheque|interac|paypal)/;

  if (text.match(/^quit|^exit/)) {
    console.log('Bye.');
    process.exit();
  } else if (text.match(/^users/)) {
    console.log(prettyPrint(users));
  } else if (text.match(/^user/)) {
    console.log(user);
  } else if (text.match(/^reload/)) {
    // reload the payment data
    payments = loadPayments();
    console.log('payments loaded');
  } else if (text.match(paymentRegex)) {
    // single payment command lets you add a payment
    var matches = text.match(paymentRegex);
    var command = matches[1];
    if (command == 'add') {
      var payment = new Payment(matches[2], matches[3], matches[4], (new Date()).format(options.date_format));
      payments.push(payment);
      console.log("Adding payment: %s", payment);
    } else {
      console.log(prettyPrint(payments));
    }
  } else if (text.match(/^payments/)) {
    // find payments based on a name, or print all if no name specified
    var matches = text.match(/^payments (.+)/);
    if (matches) {
      var filteredPayments = filterPayments(matches[1]);
      if (filteredPayments.length > 0) {
        console.log(prettyPrint(filteredPayments));
      } else {
        console.log("No payments found that match '%s'", matches[1]);
      }
    } else {
      console.log(prettyPrint(payments));
    }
  } else if (text.match(emailCommandRegex)) {
    matches = text.match(emailCommandRegex);
    var emailType = matches[1];
    var name = matches[2];
    var user = _.find(users, function(user){
      return user.name.match(name);
    });
    var filteredPayments = filterPayments(name);
    switch(emailType) {
      case "reminder":
        emailer.sendReminderEmail(user.email, user, filteredPayments, options, function(error, subject, email){
          email_log.write((new Date).getTime() + " email reminder sent to " + email + '\n');
        });
        break;
      case "receipt":
        emailer.sendReceiptEmail(user.email, user, _.last(filteredPayments), filteredPayments, options, function(error, subject, email){
          email_log.write((new Date).getTime() + " email reminder sent to " + email + '\n');
        });
        break;
      default:
        console.log("No email type '%s' known.", emailType);
        break;
    }
  } else {
    console.log("No command found that matches");
  }
});

function loadFromCSV(file, lineMethod) {
  var deferred = Q.defer();

  Q.nfcall(fs.readFile, file, 'utf8').then(function(data){
    var lines = data.split('\n');
    var payments = _.chain(lines.slice(1)).map(lineMethod).compact().value();
    deferred.resolve(payments);
  }).catch(function(error) {
    console.log(error);
  }).done();

  return deferred.promise;
}

function loadPayments() {
  return loadFromCSV(options.payments_file, function(line){
    var values = line.split(',');
    if (values == undefined || values.length <= 1 || values[0] == null || values[0].length == 0) {return;}
    var payment = new Payment(values[1], values[0], values[2] || values[3] || values[4] || values[5], values[6]);
    if (values[2].length > 0) {
      payment.type = "cash";
    } else if (values[3].length > 0) {
      payment.type = "cheque";
    } else if (values[4].length > 0) {
      payment.type = "interac";
    } else if (values[5].length > 0) {
      payment.type = "paypal";
    }
    return payment;
  });
}

function loadUsers() {
  return loadFromCSV(options.users_file, function(line){
    var values = line.split(',');
    if (values == undefined || values.length <= 1 || values[0] == null || values[0].length == 0) {return;}
    return new User(values[0], values[1], values[2], values[3]);
  });
}

function filterPayments(person) {
  return _.filter(payments, function(payment) {
    return payment.who.toLowerCase().match(person.toLowerCase());
  });
}

function prettyPrint(arr) {
  return _.map(arr, function(el){return el.toString();}).join('\n');
}
