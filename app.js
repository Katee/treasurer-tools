var path = require('path');
var Q = require('q');
var _ = require('underscore');
var util = require('util');

// put your options in options.js to override these defaults
var options = _.extend({
  email_templates_dir: path.join(__dirname, 'emails'),
  payments_file: path.join(__dirname, 'csv', 'payments.csv')
}, require(path.join(path.dirname(module.filename), 'options')));

var emailer = require(path.join(path.dirname(module.filename), 'emailer'));

var payments = [];

process.stdin.resume();
process.stdin.setEncoding('utf8');

console.log('Welcome to Treasurer tools');
// automatically load the payment data
payments = loadPayments();

process.stdin.on('data', function (text) {
  var emailCommandRegex = /^email (reminder|reciept|.+) ([a-z]+)/;
  if (text.match(/^quit|^exit/)) {
    console.log('Bye.');
    process.exit();
  } else if (text.match(/^user/)) {
    console.log(user);
  } else if (text.match(/^reload/)) {
    // reload the payment data
    payments = loadPayments();
    console.log('payments loaded');
  } else if (text.match(/^payments/)) {
    // find payments based on a name, or print all if no name specified
    var matches = text.match(/^payments (.+)/);
    if (matches) {
      var filteredPayments = filterPayments(matches[1]);
      if (filteredPayments.length > 0) {
        console.log(prettyPrintPayments(filteredPayments));
      } else {
        console.log("No payments found that match '%s'", matches[1]);
      }
    } else {
      console.log(prettyPrintPayments(payments));
    }
  } else if (text.match(emailCommandRegex)) {
    matches = text.match(emailCommandRegex);
    var emailType = matches[1];
    var name = matches[2];
    switch(emailType) {
      case "reminder":
        emailer.sendReminderEmail('hello@kate.io', user, [payment], options);
        break;
      case "receipt":
        var filteredPayments = filterPayments(name);
        emailer.sendReceiptEmail('hello@kate.io', user, _.last(filteredPayments), filteredPayments, options);
        break;
      default:
        console.log("No email type '%s' known.", emailType);
        break;
    }
  }
});

function loadPayments() {
  var fs = require('fs');
  payments = [];

  fs.readFile(options.payments_file, 'utf8', function (err, data) {
    if (err) throw err;
    var lines = data.split('\n');
    _.each(lines.slice(1), function(line){
      var values = line.split(',');
      if (values.length <= 1) return;
      var tags = values[2].split('|');
      if (values[0] == null || values[0].length == 0) {return;}
      var payment = {
        date: values[0],
        who: values[1],
        amount: values[2] || values[3] || values[4] || values[5],
        notes: values[6]
      };
      if (values[2].length > 0) {
        payment.type = "cash";
      } else if (values[3].length > 0) {
        payment.type = "cheque";
      } else if (values[4].length > 0) {
        payment.type = "interac";
      } else if (values[5].length > 0) {
        payment.type = "paypal";
      }
      payments.push(payment);
    });
  });

  return payments;
}

function filterPayments(person) {
  return _.filter(payments, function(payment) {
    return payment.who.toLowerCase().match(person.toLowerCase());
  });
}

function prettyPrintPayments(payments) {
  return _.map(payments, function(payment){
    return [payment.date, payment.who, payment.amount].join(', ');
  }).join('\n');
}
