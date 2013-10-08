# Treasurer Tools

A collection of tools to help me be lazy and still get done my tasks as treasurer done.

## Features

* List members and payments with filtering
* Send reminder and receipt emails (using Gmail)

## Usage

* `./treasure payments` List all payments
* `./treasure payments filter` List all payments that contain the text in 'filter' somewhere in the name, amount, type, date or notes.
* `./treasure payment add 50.00 cash Katherine Murphy` Create a new payment of $50 of type cash for the user Katherine Murphy, this will send a receipt email to the user.
* `./treasure users` List all users
* `./treasure users filter` List all users that contain the text in 'filter' somewhere in the name, email, nick or notes.

## Setup

Move options.sample.js to options.js and edit the options to include your gmail details.
Move data-sample to data and fill in your payments as needed.

The receipt and reminder emails are in `/emails` and contain Hacklab specific material.
