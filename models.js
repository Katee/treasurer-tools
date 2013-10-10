var _ = require('underscore');
require('date-format-lite');

var MONTHS_IN_YEAR = 12;
var start_date = '2012/01/01';

module.exports.User = User;
module.exports.Payment = Payment;

function User(name, nick, email, notes, joinDate) {
  this.name = name;
  this.nick = nick;
  this.email = email;
  this.notes = notes;
  this.joinDate = joinDate;
}

User.prototype.toString = function() {
  return _.compact([this.name, this.nick, this.email, this.notes, this.joinDate]).join(', ');
};

User.prototype.serialize = function() {
  return [this.name, this.nick, this.email, this.notes, this.joinDate].join(',');
};

User.prototype.findPayments = function(payments) {
  var user = this;
  return _.filter(payments, function(payment) {
    return payment.who === user.name && !payment.isDonation();
  });
};

User.prototype.findDonations = function(payments) {
  var user = this;
  return _.filter(payments, function(payment) {
    return payment.who === user.name && payment.isDonation();
  });
};

User.prototype.dueDate = function(payments) {
  var userPayments = this.findPayments(payments);
  var total = _.reduce(userPayments, function(m,p){return m + Number(p.value());}, 0).toFixed(2);
  var months_paid = Math.round(total / 50);
  var d = new Date(start_date);
  d.setMonth((d.getMonth()) + months_paid % MONTHS_IN_YEAR);
  d.setFullYear(d.getFullYear() + Math.floor(months_paid / MONTHS_IN_YEAR));
  return d;
};

function Payment(who, date, amount, type, notes) {
  this.who = who;
  this.date = date;
  this.amount = Number(amount);
  this.type = type;
  this.notes = notes;
}

// paypal payments are slightly more, but the 'value' (to calculate months covered) is only 50
Payment.prototype.value = function() {
  if (this.type === 'paypal' && this.amount === 51.75) {
    return '50.00';
  }
  return this.amount.toFixed(2);
};

// pretty hacky way to tell donations from normal payments
Payment.prototype.isDonation = function() {
  return this.who === 'DONATIONS' || this.notes.toLowerCase().match('donation') !== null;
};

Payment.prototype.toString = function() {
  return this.date + ": " + this.who + " paid $" + this.amount.toFixed(2) + " by " + this.type + " " + (this.notes || '');
};

Payment.prototype.serialize = function() {
  return [this.date, this.who, this.amount.toFixed(2), this.type, this.notes].join(',');
};

Payment.deserialize = function(serialized) {
  var values = serialized.split(',');
  return new Payment(values[1], values[0], values[2], values[3], values[4], values[5]);
};
