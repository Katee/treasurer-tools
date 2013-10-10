var path = require('path');
var Q = require('q');
var _ = require('underscore');
var util = require('util');
var fs = require('fs');
require('date-format-lite');

var emailer = require('./emailer');
var models = require('./models');
var Payment = models.Payment;
var User = models.User;

// put your options in options.js to override these defaults
var options = _.extend({
  date_format: "YYYY-MM-DD",
  email_templates_dir: path.join(__dirname, 'emails'),
  payments_file: path.join(__dirname, 'data', 'payments.csv'),
  users_file: path.join(__dirname, 'data', 'users.csv'),
  email_log: path.join(__dirname, 'data', 'emails.log'),
  donation_names: [] // names to treat as donations
}, require('./options'));

module.exports.dispatchCommand = dispatchCommand;
module.exports.loadData = loadData;
module.exports.loadFromCSV = loadFromCSV;
module.exports.options = options;
module.exports.models = models;

var payments = [];
var users = module.exports.users = [];

module.exports.payments = payments;
module.exports.users = users;

var email_log = fs.createWriteStream(options.email_log, {'flags': 'a'});
var payments_log = fs.createWriteStream(options.payments_file, {'flags': 'a'});

function loadData() {
  var deferred = Q.defer();

  // automatically load the payments and users on start
  Q.allSettled([loadPayments(), loadUsers()]).spread(function(paymentsPromise, usersPromise){
    payments = paymentsPromise.value;
    users = usersPromise.value;
    module.exports.payments = payments;
    module.exports.users = users;
    deferred.resolve(null);
  }).catch(function(err){
    deferred.reject();
    console.log(err);
  });

  return deferred.promise;
}

function dispatchCommand(text) {
  // TODO proprely tokenize
  var commandRegex = /^([a-z]+)([a-zA-Z0-9 $."'-]*)/;
  var command = text.match(commandRegex);
  var restOfCommand = command[2].trim();

  switch(command[1]) {
  case "users":
    handleCommandUsers(restOfCommand);
    break;
  case "payment":
    handleCommandPayment(restOfCommand);
    break;
  case "payments":
    handleCommandPayments(restOfCommand);
    break;
  case "email":
    handleCommandEmail(restOfCommand);
    break;
  case "info":
    handleCommandInfo(restOfCommand);
    break;
  case "quit":
  case "exit":
    console.log('Bye.');
    process.exit();
    break;
  default:
    console.log("No command found that matches");
    break;
  }
}

// show all or a filtered set of users
function handleCommandUsers(filter) {
  if (filter) {
    var filteredUsers = filterUsers(filter);
    if (filteredUsers.length > 0) {
      console.log(prettyPrint(filteredUsers));
    } else {
      console.log("No users found that match '%s'", filter);
    }
  } else {
    console.log(prettyPrint(users));
  }
}

// single payment command lets you add a payment
function handleCommandPayment(command) {
  var paymentRegex = /^(add) ([0-9]+\.[0-9]{0,2}|[0-9]+) (cash|cheque|interac|paypal) (".+"|'.+'|[a-zA-Z ]+)/;
  var matches = command.match(paymentRegex);
  if (matches) {
    var action = matches[1];

    var name = matches[4];
    var selectedUsers = findUserFromCommand(name);
    if (_.size(selectedUsers) == 0) {
      console.log("No user found.")
      return;
    } else if (_.size(selectedUsers) > 1) {
      console.log("'%s' could referr to %s", name, _.pluck(selectedUsers, 'name').join(', '));
      return;
    }
    var user = selectedUsers[0];

    var amount = matches[2];
    var method = matches[3];
    var date = (new Date()).format(options.date_format);
    var notes = null;

    var payment = new Payment(user.name, date, amount, method, notes);
    payments.push(payment);
    payments_log.write(payment.serialize() + '\n');
    console.log("Added payment: %s", payment);
  } else {
    console.log("Not sure about : '%s'", command);
  }
}

// find payments based on a name, or print all if no name specified
function handleCommandPayments(filter) {
  if (filter) {
    var filteredPayments = filterPayments(filter);
    if (filteredPayments.length > 0) {
      console.log(prettyPrint(filteredPayments));
      console.log('%s payments, total value: $%s', filteredPayments.length, _.reduce(filteredPayments, function(m,p){return m + Number(p.amount);}, 0).toFixed(2));
    } else {
      console.log("No payments found that match '%s'", filter);
    }
  } else {
    console.log(prettyPrint(payments));
  }
}

// find user and send email
function handleCommandEmail(command) {
  var emailCommandRegex = /^(reminder|receipt|.+) ([a-zA-Z ]+)/;
  matches = command.match(emailCommandRegex);
  if (!matches) {
    console.log("Not a valid email command.");
    return;
  }
  var emailType = matches[1];
  var name = matches[2];
  var users = findUserFromCommand(name);
  if (users.length > 1) {
    console.log("No user found with '%s'", name);
    return;
  } if (users.length < 1) {
    console.log("More than one user found with '%s'", name);
    return;
  }
  var user = users[0];
  user.nextDuedate = user.dueDate(payments).format(options.date_format);
  var filteredPayments = filterPayments(name);
  var emailPromise;
  switch(emailType) {
    case "reminder":
      emailPromise = emailer.sendReminderEmail(user.email, user, filteredPayments, options);
      break;
    case "receipt":
      emailPromise = emailer.sendReceiptEmail(user.email, user, _.last(filteredPayments), filteredPayments, options);
      break;
    default:
      console.log("No email type '%s' known.", emailType);
      return;
  }

  emailPromise.then(function(emailDetails){
    var message = (new Date).getTime() + ": " + emailDetails.subject + " sent to " + emailDetails.email + '\n';
    console.log(message);
    email_log.write(message);
  });
}

// show info about a user
function handleCommandInfo(name) {
  var filteredUsers = findUserFromCommand(name);

  if (filteredUsers.length == 0) {
    console.log("No user found matching '%s'", name);
    return;
  }

  _.each(filteredUsers, showUserInfo);
}

function showUserInfo(user) {
  console.log(user.toString());

  var filteredPayments = user.findPayments(payments);
  var filteredDonations = user.findDonations(payments);
  console.log('Due date: %s', user.dueDate(payments).format(options.date_format));

  if (_.size(filteredPayments) > 0) {
    console.log(prettyPrint(filteredPayments));

    // use value method when showing a user's summary so their total reflects the number of months they have covered
    console.log('%s payments, total value: $%s', filteredPayments.length, _.reduce(filteredPayments, function(m,p){return m + Number(p.value());}, 0).toFixed(2));

    console.log('%s donations, total value: $%s', filteredDonations.length, _.reduce(filteredDonations, function(m,p){return m + Number(p.value());}, 0).toFixed(2));
  } else {
    console.log("No payments found found for %s", user.name);
  }

  console.log('');
}

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
    var payment = new Payment(values[1], values[0], values[2], values[3], values[4]);
    return payment;
  });
}

function loadUsers() {
  return loadFromCSV(options.users_file, function(line){
    var values = line.split(',');
    if (values == undefined || values.length <= 1 || values[0] == null || values[0].length == 0) {return;}
    return new User(values[0], values[1], values[2], values[3], values[4]);
  });
}

function filterPayments(filter) {
  return _.filter(payments, function(payment) {
    return payment.toString().toLowerCase().match(filter.toLowerCase());
  });
}

function filterUsers(filter) {
  return _.filter(users, function(user) {
    return user.toString().toLowerCase().match(filter.toLowerCase());
  });
}

function prettyPrint(arr) {
  return _.map(arr, function(el){return el.toString();}).join('\n');
}

function findUserFromCommand(name) {
  name = name.toLowerCase();
  return _.filter(users, function(user){
    return user.name.toLowerCase().match(name) || user.nick.toLowerCase().match(name);
  });
}
