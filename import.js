var path = require('path');
var Q = require('q');
var app = require('./app');
var models = require('./models');
var _ = require('underscore');
var fs = require('fs');
require('date-format-lite');
Date.middle_endian = true; // to match paypal date format

var ignore_names = ['Bank Account', 'From U.S. Dollar', 'To Canadian Dollar', 'From Singapore Dollar'];

module.exports.importPaypalPayments = importPaypalPayments;

function importPaypalPayments(oldPayments, csvFilename) {
  getPaymentsFromPaypalExport(csvFilename).then(function(importPayments){
    return collatePayments(oldPayments, importPayments);
  }).then(function(newPayments){
    // overwrite old payments file with our new one
    savePayments(newPayments, app.options.payments_file);
    console.log("Added %s new payments", newPayments.length - oldPayments.length);
  }).catch(function(err){
    console.log(err);
  });
}

function collatePayments(oldPayments, newPayments) {
  // get the old paypal payments from the file and serialize them for later comparison
  var oldPaypalPaymentsSerialized = _.chain(oldPayments).filter(isPaypalPayment).map(serialize).value();

  // serialize the potentially new paymets
  var importPaymentsSerialized = _.map(newPayments, serialize);

  // find the payments in the paypal csv file that do not exist in the payments file
  var newPaypalPaymentsSerialized = _.difference(importPaymentsSerialized, oldPaypalPaymentsSerialized);
  var newPaypalPayments = _.map(newPaypalPaymentsSerialized, function(a){return models.Payment.deserialize(a);});

  // add our payments to the existing ones and make sure they are sorted by date
  var mergedPayments = _.sortBy(_.union(oldPayments, newPaypalPayments), function(a){return a.date;});

  return mergedPayments;
}

function getPaymentsFromPaypalExport(filename) {
  var deferred = Q.defer();

  // create a payment from a line in the paypal csv
  app.loadFromCSV(filename, function(line, lineNumber){
    var values = line.split(',');
    if (values.length === 1) return;
    var date = values[0].date(app.options.date_format);
    var amount = values[7].replace(/"/g, '');
    var name = values[3].replace(/"/g, '');
    var user = findUserFromPaypalName(name);
    var notes = values[12].replace(/"/g, '');

    if (user.length !== 1) {
      // 13.37 is the amount for 'friends of hacklab' donations
      if (_.contains(app.options.donation_names, name) || amount == 13.37) {
        user = {name: models.Payment.DONATION_NAME};
      } else {
        if (!_.contains(ignore_names, name))
        console.log("Error: could not find user for '%s' on line %s", name, lineNumber);
        return;
      }
    } else {
      user = user[0];
    }

    return new models.Payment(user.name, date, amount, 'paypal', notes);
  }).then(function(payments){
    deferred.resolve(_.compact(payments));
  }).catch(function(err){
    console.log(err);
    deferred.reject();
  }).done();

  return deferred.promise;
}

function isPaypalPayment(payment) {
  return payment.type === 'paypal';
}

function serialize(a) {
  return a.serialize();
}

function savePayments(payments, filename) {
  var payments_log = fs.createWriteStream(filename, {'flags': 'w'});
  payments_log.write('Date,Member,Amount,Type,Notes\n');
  _.each(payments, function(payment){
    payments_log.write(payment.serialize()+'\n');
  });
}

function findUserFromPaypalName(name) {
  name = name.toLowerCase();
  return _.filter(app.users, function(user){
    return user.toString().toLowerCase().match(name) || user.nick.toLowerCase().match(name);
  });
}
