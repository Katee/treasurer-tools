module.exports.User = User;
module.exports.Payment = Payment;

function User(name, nick, email, notes) {
  this.name = name;
  this.nick = nick;
  this.email = email;
  this.notes = notes;
}

User.prototype.toString = function() {
  return [this.name, this.nick, this.email, this.notes].join(', ');
};

function Payment(who, date, amount, type, notes) {
  this.who = who;
  this.date = date;
  this.amount = Number(amount);
  this.type = type;
  this.notes = notes;
}

Payment.prototype.toString = function() {
  return this.date + ": " + this.who + " paid " + this.amount.toFixed(2) + " by " + this.type;
};
