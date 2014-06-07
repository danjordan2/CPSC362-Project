 var url = require('url');
 var MongoClient = require('mongodb').MongoClient;
 var ObjectID = require('mongodb').ObjectID;
 var moment = require('moment');
 var dbAddress = "mongodb://localhost:27017/standalonetech";
 //========================================================================
 // Module: index
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module handles the direct of users to their proper page.
 //          Users logged in as a customer will be redirected to /customer/
 //          and users logged in as employee will be redirected to /employee/ 
 // Data Structures: JSON formatted http request
 // Additional Algorithms: None
 //========================================================================
 exports.index = function(req, res) {
     if (req.session.username) {
         res.redirect("/" + req.session.role);
     } else {
         res.redirect("/login");
     }
 };
 //========================================================================
 // Module: customer
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module displays the home page for the customer. It begins 
 //          by searching the database for the logged in user. It then looks
 //          retrieves the date for the user's next scheduled invoice, and
 //          checks if the user has any currently outstanding invoices. 
 //          The information is then rendered to the page. 
 // Data Structures: JSON structure containing the user's account in the db
 // Additional Algorithms: None
 //========================================================================
 exports.customer = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.username": req.session.username
         }, function(err, result) {
             var billing_day = result.user.billing.bill_day;
             //Format invoice due date
             var due_date = moment({
                 day: billing_day
             }).format("MM/DD/YY");
             //If today is end of bill cycle, increment month for next cycle
             if (moment().format("DD") >= billing_day) {
                 due_date = moment(due_date, "MM/DD/YY").add('months', 1).format("MM/DD/YY");
             }
             var outstanding = 0;
             result.user.billing.invoices.forEach(function(record) {
                 if (record.status === 'due' || record.status === 'overdue') outstanding++;
             });
             open_tickets = db.collection("tickets").find({
                 "username": req.session.username,
             }).sort({
                 "updated.time": -1
             }).toArray(function(err, tickets) {
                 var open_tickets = 0;
                 var ticket = {
                     id: "",
                     last_update: "",
                     subject: ""
                 };
                 if (tickets.length > 0) {
                     ticket.id = tickets[0]._id;
                     ticket.last_update = tickets[0].updated.user;
                     ticket.subject = tickets[0].subject;
                     ticket.role = tickets[0].updated.role;
                     tickets.forEach(function(ticket) {
                         if (ticket.status === "Open") {
                             open_tickets++;
                         }
                     })
                 }
                 res.render('customer/customer_dash', {
                     outstanding: outstanding,
                     due_date: due_date,
                     date: moment().format("MM/DD/YY"),
                     balance: result.user.billing.total.toFixed(2),
                     flags: result.user.billing.flags,
                     open_tickets: open_tickets,
                     ticket: ticket,
                     name: req.session.name
                 });
             });
         });
     });
 };
 //========================================================================
 // Module: login
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module renders an html page containing the login form. 
 // Data Structures: None
 // Additional Algorithms: None
 //========================================================================
 exports.login = function(req, res) {
     res.render('global/login');
 };
 //========================================================================
 // Module: login
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module handles the data posted from the login form. 
 //          It begins by searching the database for the username entered
 //          by the user. If the user doesn't exist, the user is sent back
 //          to the login form, with a generic error message. If the user
 //          does exist, it compares the password entered by the user with
 //          the password stored in the database. If the two match, an http
 //          session is generated for the user. The user's username, full name,
 //          and role (customer or employee) are stored in the session. The user
 //          is then redirected to their role page (/customer/ or /employee/).
 //          If the passwords don't match, the user is sent back to the login form
 //          with a generic error message.    
 // Data Structures: JSON structure containing the user's profile data. 
 // Additional Algorithms: None
 //========================================================================
 exports.login_post = function(req, res) {
     var username = req.body.user;
     var password = req.body.password;
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.username": username
         }, function(err, result) {
             if (result) {
                 //Check if password matches
                 if (result.user.username == username && result.user.password == password) {
                     //Check if account is in good standing
                     if (result.user.standing === "Closed") {
                         res.render('global/login', {
                             name: req.session.username,
                             error: "Account has been closed"
                         });
                     } else {
                         req.session.regenerate(function() {
                             req.session.username = result.user.username;
                             req.session.name = result.user.name;
                             req.session.role = result.user.role;
                             res.redirect("/" + result.user.role);
                         });
                     }
                 } else {
                     res.render('global/login', {
                         name: req.session.username,
                         error: "Incorrect username or password"
                     });
                 }
             } else {
                 res.render('global/login', {
                     name: req.session.username,
                     error: "Incorrect username or password"
                 });
             }
         });
     });
 };
 //========================================================================
 // Module: logout
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module handles the logging out of a user. It destroys the 
 //          session which contains the user's username. Upon being redirected
 //          back to the root "/" page, they'll be asked to login again.  
 // Data Structures: None
 // Additional Algorithms: None
 //========================================================================
 exports.logout = function(req, res) {
     req.session.destroy(function() {
         res.redirect('/');
     });
 };
 //========================================================================
 // Module: customer_view_profile
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module displays the user's profile information. It begins
 //          by searching the database for the logged in user. It then passes
 //          that information to an html page, displaying the data in a form 
 // Data Structures: JSON structure containing the user's profile data
 // Additional Algorithms: None
 //========================================================================
 exports.customer_view_profile = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.username": req.session.username
         }, function(err, result) {
             res.render('customer/customer_view_profile', {
                 name: req.session.name,
                 user: result.user
             });
         });
     });
 };
 //========================================================================
 // Module: customer_edit_profile
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module edits a user's profile data. It begins by searching
 //          for a user in the database. If the user exists, we update their
 //          profile data with the values posted from the html form. After
 //          updating, the database entry is then returned back to us, and
 //          rendered on the page. We also pass a success message, letting
 //          the user know it was successfull 
 // Data Structures: JSON structure containing the user's profile data
 // Additional Algorithms: None
 //========================================================================
 exports.customer_edit_profile = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findAndModify({
             "user.username": req.session.username
         }, [
             ['_id', 'asc']
         ], {
             $set: {
                 "user.name": req.body.name,
                 "user.email": req.body.email,
                 "user.address": req.body.address,
                 "user.city": req.body.city,
                 "user.state": req.body.state,
                 "user.zip": req.body.zip,
                 "user.phone": req.body.phone
             }
         }, {
             new: true
         }, function(err, result) {
             //Update name in session, in case user edited name 
             req.session.name = result.user.name;
             res.render('customer/customer_view_profile', {
                 alert: "Profile successfully edited!",
                 user: result.user,
                 name: req.session.name
             });
         });
     });
 };
 //========================================================================
 // Module: customer_password
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module renders an html page which contains a form to 
 //          edit a user's password  
 // Data Structures: None
 // Additional Algorithms: None
 //========================================================================
 exports.customer_password = function(req, res) {
     res.render('customer/customer_password', {
         name: req.session.name
     })
 };
 //========================================================================
 // Module: customer_edit_password
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module allows a user to edit their password. It receives
 //          data posted from an html form, containing the user's current
 //          password, a new password, and a confirmation of the new password.
 //          The function begins by comparing the new password with the confirmed
 //          password. If the two do not match, the function stops and renders
 //          a page with an error message. If the two values match, the function
 //          goes into the database and pulls up the user's password. It then
 //          compares the user's password with the value entered in by the user.
 //          If the two match, the user's password is updated with the new password
 //          entered by the user. A page is then rendered with a success message.
 //          If the passwords don't match, a page is rendered with an error message. 
 // Data Structures: JSON structure containing the user's profile data
 // Additional Algorithms: None
 //========================================================================
 exports.customer_edit_password = function(req, res) {
     //Check if user typed password correctly
     if (req.body.new_password != req.body.confirm_password) {
         res.render('customer/customer_password', {
             error: "New passwords do not match",
             name: req.session.name
         });
     } else {
         //Lookup existing password
         MongoClient.connect(dbAddress, function(err, db) {
             db.collection("accounts").findOne({
                 "user.username": req.session.username
             }, function(err, result) {
                 if (result) {
                     //Verify user entered existing password correctly
                     if (result.user.password === req.body.current_password) {
                         //Set new password
                         db.collection("accounts").update({
                             "user.username": req.session.username
                         }, {
                             $set: {
                                 "user.password": req.body.new_password
                             }
                         }, function(err, result) {
                             if (!err) {
                                 res.render('customer/customer_password', {
                                     msg: "Password successfully updated!",
                                     name: req.session.name
                                 });
                             } else {
                                 res.render('customer/customer_password', {
                                     error: "Error updating password",
                                     name: req.session.name
                                 });
                             }
                         });
                     } else {
                         res.render('customer/customer_password', {
                             error: "Incorrect password",
                             name: req.session.name
                         });
                     }
                 }
             });
         });
     };
 };
 //========================================================================
 // Module: customer_invoices
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module displays due or overdue invoices for the user.
 //          The function begins by searching for the username contained
 //          in the user's session. It then returns all of the invoices for
 //          the user. All invoices that haven't been paid are pushed onto
 //          an array, and rednered on the page.   
 // Data Structures: JSON structure containing user invoice data.
 // Additional Algorithms: None
 //========================================================================
 exports.customer_invoices = function(req, res) {
     var due_invoices = [];
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.username": req.session.username
         }, {
             "user.billing.invoices": 1
         }, function(err, result) {
             if (url.parse(req.url, true).query.msg) {
                 var msg = url.parse(req.url, true).query.msg;
             }
             result.user.billing.invoices.forEach(function(invoice) {
                 invoice.amount = invoice.amount.toFixed(2);
                 if (invoice.status != "paid") {
                     due_invoices.push(invoice);
                 }
             });
             //Sort invoices by date posted
             due_invoices.sort(function(a, b) {
                 var date1 = moment(a.posted, 'MM/DD/YY');
                 var date2 = moment(b.posted, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return 1;
                 } else {
                     return -1;
                 }
             });
             res.render('customer/customer_view_invoices', {
                 invoices: due_invoices,
                 name: req.session.name,
                 msg: msg
             });
         });
     });
 };
 //========================================================================
 // Module: customer_view_invoice
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module displays a single invoice for the user to view.
 //          It begins by searching for an invoice with an ID matching an ID
 //          passed in via the URL. That invoice is then returned, along with
 //          the personal information for the user it belongs to, along with 
 //          that user's current subscription plan. A security check is done
 //          to verify that the user attempting to view the invoice is the same
 //          user that the invoice belongs to. If they are not, they get redirected
 //          to a page with an error message. Otherwise, a page is rendered with the
 //          invoice data. 
 // Data Structures: JSON structure containing user invoice data.
 // Additional Algorithms: None
 //========================================================================
 exports.customer_view_invoice = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.billing.invoices._id": new ObjectID(req.params.id)
         }, {
             //Only return the following fields
             "user.name": 1,
             "user.username": 1,
             "user.address": 1,
             "user.city": 1,
             "user.state": 1,
             "user.zip": 1,
             "user.phone": 1,
             //Return entire invoice object
             "user.billing.invoices.$": 1,
             //Return entire plan object
             "user.billing.plan": 1
         }, function(err, result) {
             //Keep users from viewing other customers' invoice
             if (result.user.username != req.session.username) {
                 res.redirect('/customer/unauthorized');
             }
             //Show invoice
             else {
                 var payment_button = "";
                 var invoice = result.user.billing.invoices[0];
                 if (invoice.status === "paid") {
                     payment_button = "disabled";
                 }
                 res.render('customer/customer_view_invoice', {
                     id: invoice._id,
                     start_date: moment(invoice.posted).subtract('months', 1).format("MM/DD/YY"),
                     end_date: invoice.posted,
                     total: invoice.amount.toFixed(2),
                     status: invoice.status,
                     plan: result.user.billing.plan,
                     full_name: result.user.name,
                     address: result.user.address,
                     city: result.user.city,
                     state: result.user.state,
                     zip: result.user.zip,
                     phone: result.user.phone,
                     name: req.session.name,
                     payment_button: payment_button
                 });
             }
         });
     });
 };
 //========================================================================
 // Module: customer_pay_invoice
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module processes payment on an invoice. Payment data is 
 //          posted from an html form, and the invoice ID is passed in via URL.
 //          The function then searches the database for an invoice matching the ID.
 //          The status of the invoice is then set to "paid". A new object is then 
 //          pushed to the database, with all of the billing data entered by the user.
 //          The user's current plan is also included in the payment data. The user
 //          is then redirected back to the main invoice page, with a message confirming
 //          payment. 
 // Data Structures: JSON structure containing user invoice data.
 // Additional Algorithms: None
 //========================================================================
 exports.customer_pay_invoice = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findAndModify({
             'user.billing.invoices._id': new ObjectID(req.params.id)
         }, ['_id', 'asc'], {
             $set: {
                 'user.billing.invoices.$.status': "paid"
             }
         }, {
             new: true
         }, function(err, result) {
             db.collection("accounts").update({
                 "user.username": req.session.username
             }, {
                 $push: {
                     "user.billing.payments": {
                         "_id": new ObjectID(),
                         "invoice_id": new ObjectID(req.params.id),
                         "date": moment().format("MM/DD/YY"),
                         "amount": parseFloat(req.body.amount),
                         "status": "paid",
                         "name": req.body.name,
                         "address": req.body.address,
                         "city": req.body.city,
                         "state": req.body.state,
                         "zip": req.body.zip,
                         "card": req.body.card,
                         "exp_month": req.body.exp_month,
                         "exp_year": req.body.exp_year,
                         "plan": result.user.billing.plan
                     }
                 }
             }, function(err) {
                 res.redirect('/customer/account/invoices?msg=Thank%20You%20For%20Your%20Payment')
             });
         });
     });
 };
 //========================================================================
 // Module: customer_payments
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module displays all past payments made by the user. It begins
 //          by searching the database for the logged in user. That user's 
 //          payment history is returned, and rendered on the page. 
 // Data Structures: JSON structure containing user payment data.
 // Additional Algorithms: None
 //========================================================================
 exports.customer_payments = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.username": req.session.username
         }, {
             "user.billing.payments": 1
         }, function(err, result) {
             result.user.billing.payments.forEach(function(payment) {
                 payment.amount = payment.amount.toFixed(2);
             })
             //Sort receipts by payment date
             result.user.billing.payments.sort(function(a, b) {
                 var date1 = moment(a.date, 'MM/DD/YY');
                 var date2 = moment(b.date, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return -1;
                 } else {
                     return 1;
                 }
             });
             res.render('customer/customer_view_payments', {
                 payments: result.user.billing.payments,
                 name: req.session.name
             });
         });
     });
 };
 //========================================================================
 // Module: customer_view_payment
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module displays a single receipt for the user to view.
 //          It begins by searching for a receipt with an ID matching an ID
 //          passed in via the URL. That receipt is then returned, along with
 //          the personal information for the user it belongs to. A security 
 //          check is done to verify that the user attempting to view the receipt
 //          is the same user that the receipt belongs to. If they are not, 
 //          they get redirected to a page with an error message. Otherwise, 
 //          a page is rendered with the receipt data. As an additional security
 //          precaution, the credit card used for the receipt is partially masked,
 //          before it is displayed on the page. Only the last 4 digits will be
 //          displayed to the user. 
 // Data Structures: JSON structure containing user payment data.
 // Additional Algorithms: None
 //========================================================================
 exports.customer_view_payment = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.billing.payments._id": new ObjectID(req.params.id)
         }, {
             //Only return the following fields
             "user.name": 1,
             "user.username": 1,
             "user.address": 1,
             "user.city": 1,
             "user.state": 1,
             "user.zip": 1,
             "user.phone": 1,
             //Return entire invoice object
             "user.billing.payments.$": 1,
             //Return entire plan object
             "user.billing.plan": 1
         }, function(err, result) {
             //Keep users from viewing other customers' invoice
             if (result.user.username != req.session.username) {
                 res.redirect('/customer/unauthorized');
             }
             //Show invoice
             else {
                 var payment = result.user.billing.payments[0];
                 //Replace all but last 4 characters of card number with *
                 var card = "";
                 for (var i = 0; i < payment.card.length - 4; i++) {
                     card += "*";
                 }
                 res.render('customer/customer_view_payment', {
                     id: payment._id,
                     user: result.user.name,
                     date: payment.date,
                     total: payment.amount.toFixed(2),
                     status: payment.status,
                     address: result.user.address,
                     city: result.user.city,
                     state: result.user.state,
                     zip: result.user.zip,
                     phone: result.user.phone,
                     payment: payment,
                     card: card + payment.card.slice(-4),
                     name: req.session.name
                 });
             }
         });
     });
 };
 //========================================================================
 // Module: customer_view_services
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module will allow a user to view their current service,
 //          as well as display other available plans that they can upgrade to.
 //          The function begins by searching the database for all available plans.
 //          It then searches the database for the logged in user, and accesses 
 //          their current subscription plan. The two sets of data are then 
 //          rendered on the page. 
 // Data Structures: JSON structure containing user's subscription data, and
 //                  other available subscription plans
 // Additional Algorithms: None
 //========================================================================
 exports.customer_view_services = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("plans").find().toArray(function(err, plans) {
             plans.forEach(function(plan) {
                 plan.price = plan.price.toFixed(2);
             })
             db.collection("accounts").findOne({
                 "user.username": req.session.username
             }, function(err, result) {
                 result.user.billing.plan.price = result.user.billing.plan.price.toFixed(2);
                 if (url.parse(req.url, true).query.msg) {
                     var msg = url.parse(req.url, true).query.msg;
                 }
                 res.render('customer/customer_view_services', {
                     name: req.session.name,
                     plans: plans,
                     current_plan: result.user.billing.plan,
                     msg: msg
                 })
             })
         })
     });
 };
 //========================================================================
 // Module: customer_edit_services
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module edits the user's current subscription plan. A value
 //          is posted from an html form, containing the ID for the selected
 //          service plan. The function then searches for that service plan
 //          in the database. The logged in user is then searched for in the 
 //          database, and their current service plan is updated with the 
 //          service plan returned from the database. The user is then redirected
 //          back to the services page, with a confirmation message notifying
 //          the user that the change was successful. 
 // Data Structures: JSON structure containing the new service plan data.
 // Additional Algorithms: None
 //========================================================================
 exports.customer_edit_services = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("plans").findOne({
             "_id": new ObjectID(req.body.plan)
         }, {
             "_id": 0
         }, function(err, result) {
             db.collection("accounts").findAndModify({
                 'user.username': req.session.username
             }, ['_id', 'asc'], {
                 $set: {
                     'user.billing.plan': result
                 }
             }, function(err, result) {
                 res.redirect('/customer/account/services?msg=Successfully%20Edited%20Service');
             });
         })
     })
 };
 //========================================================================
 // Module: unauthorized_customer
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module renders an html page with a message alerting the 
 //          user that they aren't supposed to be there. This is mainly 
 //          used for pages that access variables via public URLs. If a user
 //          tries to access the page "/customer/invoice/123", and invoice "123"
 //          doesn't belong to that user, they get redirected here. 
 // Data Structures: None
 // Additional Algorithms: None
 //========================================================================
 exports.unauthorized_customer = function(req, res) {
     res.render('customer/customer_unauthorized', {
         name: req.session.username
     })
 };
 exports.employee = function(req, res) {
     var overdue_invoices = [];
     var payments = [];
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").find({
             "user.role": "customer"
         }).toArray(function(err, result) {
             result.forEach(function(account) {
                 //Retrieve all due/overdue invoices for each user
                 account.user.billing.invoices.forEach(function(record) {
                     //Get username for each invoice
                     record.user = account.user.name;
                     if (record.status === "overdue" || record.status === "due") {
                         overdue_invoices.push(record);
                     }
                 })
                 //Retrieve payments for each user
                 account.user.billing.payments.forEach(function(payment) {
                     payments.push(payment);
                 });
             });
             //Sort invoices by due date. Oldest first
             overdue_invoices.sort(function(a, b) {
                 var date1 = moment(a.due, 'MM/DD/YY');
                 var date2 = moment(b.due, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return 1;
                 } else {
                     return -1;
                 }
             });
             //Sort transactions by payment date. Newest first
             payments.sort(function(a, b) {
                 var date1 = moment(a.date, 'MM/DD/YY');
                 var date2 = moment(b.date, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return 1;
                 } else {
                     return -1;
                 }
             });
             open_tickets = db.collection("tickets").find({
                 "status": "Open"
             }).sort({
                 "updated.time": -1
             }).toArray(function(err, tickets) {
                 var billing_tickets = 0;
                 var tech_tickets = 0;
                 var general_tickets = 0;
                 var ticket = {
                     id: "",
                     last_update: "",
                     subject: "",
                     role: "",
                 };
                 if (tickets.length > 0) {
                     ticket.id = tickets[0]._id;
                     ticket.last_update = tickets[0].updated.user;
                     ticket.subject = tickets[0].subject;
                     ticket.role = tickets[0].updated.role;
                     tickets.forEach(function(ticket) {
                         if (ticket.department === "Billing") {
                             billing_tickets++;
                         } else if (ticket.department === "Technical") {
                             tech_tickets++;
                         } else if (ticket.department === "General") {
                             general_tickets++;
                         }
                     });
                 }
                 res.render('employee/employee_dash', {
                     invoices: overdue_invoices.slice(0, 5),
                     ticket: ticket,
                     general_tickets: general_tickets,
                     billing_tickets: billing_tickets,
                     tech_tickets: tech_tickets,
                     payments: payments.slice(0, 5),
                     name: req.session.name
                 });
             });
         });
     });
 };
 //========================================================================
 // Module: employee_view_profile
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module displays the user's profile information. It begins
 //          by searching the database for the logged in user. It then passes
 //          that information to an html page, displaying the data in a form 
 // Data Structures: JSON structure containing the user's profile data
 // Additional Algorithms: None
 //========================================================================
 exports.employee_view_profile = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.username": req.session.username
         }, function(err, result) {
             res.render('employee/employee_view_profile', {
                 name: req.session.name,
                 user: result.user
             });
         });
     });
 };
 //========================================================================
 // Module: customer_edit_profile
 // Date: 4/16/14
 // Programmer: Daniel Jordan
 // Purpose: This module edits a user's profile data. It begins by searching
 //          for a user in the database. If the user exists, we update their
 //          profile data with the values posted from the html form. After
 //          updating, the database entry is then returned back to us, and
 //          rendered on the page. We also pass a success message, letting
 //          the user know it was successfull 
 // Data Structures: JSON structure containing the user's profile data
 // Additional Algorithms: None
 //========================================================================
 exports.employee_edit_profile = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findAndModify({
             "user.username": req.session.username
         }, [
             ['_id', 'asc']
         ], {
             $set: {
                 "user.name": req.body.name,
                 "user.email": req.body.email,
                 "user.address": req.body.address,
                 "user.city": req.body.city,
                 "user.state": req.body.state,
                 "user.zip": req.body.zip,
                 "user.phone": req.body.phone
             }
         }, {
             new: true
         }, function(err, result) {
             //Update name in session, in case user edited name 
             req.session.name = result.user.name;
             res.render('employee/employee_view_profile', {
                 alert: "Profile successfully edited!",
                 user: result.user,
                 name: req.session.name
             });
         });
     });
 };
 //========================================================================
 // Module: employee_password
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module renders an html page which contains a form to 
 //          edit a user's password  
 // Data Structures: None
 // Additional Algorithms: None
 //========================================================================
 exports.employee_password = function(req, res) {
     res.render('employee/employee_password', {
         name: req.session.name
     })
 };
 //========================================================================
 // Module: employee_edit_password
 // Date: 4/14/14
 // Programmer: Daniel Jordan
 // Purpose: This module allows a user to edit their password. It receives
 //          data posted from an html form, containing the user's current
 //          password, a new password, and a confirmation of the new password.
 //          The function begins by comparing the new password with the confirmed
 //          password. If the two do not match, the function stops and renders
 //          a page with an error message. If the two values match, the function
 //          goes into the database and pulls up the user's password. It then
 //          compares the user's password with the value entered in by the user.
 //          If the two match, the user's password is updated with the new password
 //          entered by the user. A page is then rendered with a success message.
 //          If the passwords don't match, a page is rendered with an error message. 
 // Data Structures: JSON structure containing the user's profile data
 // Additional Algorithms: None
 //========================================================================
 exports.employee_edit_password = function(req, res) {
     //Check if user typed password correctly
     if (req.body.new_password != req.body.confirm_password) {
         res.render('employee/employee_password', {
             error: "New passwords do not match",
             name: req.session.name
         });
     } else {
         //Lookup existing password
         MongoClient.connect(dbAddress, function(err, db) {
             db.collection("accounts").findOne({
                 "user.username": req.session.username
             }, function(err, result) {
                 if (result) {
                     //Verify user entered existing password correctly
                     if (result.user.password === req.body.current_password) {
                         //Set new password
                         db.collection("accounts").update({
                             "user.username": req.session.username
                         }, {
                             $set: {
                                 "user.password": req.body.new_password
                             }
                         }, function(err, result) {
                             if (!err) {
                                 res.render('employee/employee_password', {
                                     msg: "Password successfully updated!",
                                     name: req.session.name
                                 });
                             } else {
                                 res.render('employee/employee_password', {
                                     error: "Error updating password",
                                     name: req.session.name
                                 });
                             }
                         });
                     } else {
                         res.render('employee/employee_password', {
                             error: "Incorrect password",
                             name: req.session.name
                         });
                     }
                 }
             });
         });
     };
 };
 exports.employee_view_invoices = function(req, res) {
     var overdue_invoices = [];
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").find({
             "user.role": "customer"
         }, {
             "user.billing.invoices": 1,
             "user.name": 1
         }).toArray(function(err, result) {
             result.forEach(function(account) {
                 account.user.billing.invoices.forEach(function(record) {
                     //Get username for each invoice
                     record.user = account.user.name;
                     if (record.status === "overdue" || record.status === "due") {
                         overdue_invoices.push(record);
                     }
                 })
             })
             //Sort invoices by due date. Oldest first
             overdue_invoices.sort(function(a, b) {
                 var date1 = moment(a.due, 'MM/DD/YY');
                 var date2 = moment(b.due, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return 1;
                 } else {
                     return -1;
                 }
             });
             res.render('employee/employee_view_invoices', {
                 invoices: overdue_invoices,
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_view_invoice = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.billing.invoices._id": new ObjectID(req.params.id)
         }, {
             //Only return the following fields
             "user.name": 1,
             "user.username": 1,
             "user.address": 1,
             "user.city": 1,
             "user.state": 1,
             "user.zip": 1,
             "user.phone": 1,
             //Return entire invoice object
             "user.billing.invoices.$": 1,
             //Return entire plan object
             "user.billing.plan": 1
         }, function(err, result) {
             var invoice = result.user.billing.invoices[0];
             res.render('employee/employee_view_invoice', {
                 id: invoice._id,
                 start_date: moment(invoice.posted).subtract('months', 1).format("MM/DD/YY"),
                 end_date: invoice.posted,
                 total: invoice.amount,
                 status: invoice.status,
                 plan: result.user.billing.plan,
                 full_name: result.user.name,
                 address: result.user.address,
                 city: result.user.city,
                 state: result.user.state,
                 zip: result.user.zip,
                 phone: result.user.phone,
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_view_payments = function(req, res) {
     var payments = [];
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").find({
             "user.role": "customer"
         }, {
             "user.billing.payments": 1
         }).toArray(function(err, result) {
             result.forEach(function(account) {
                 account.user.billing.payments.forEach(function(record) {
                     payments.push(record);
                 })
             })
             //Sort invoices by due date. Oldest first
             payments.sort(function(a, b) {
                 var date1 = moment(a.date, 'MM/DD/YY');
                 var date2 = moment(b.date, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return 1;
                 } else {
                     return -1;
                 }
             });
             res.render('employee/employee_view_payments', {
                 payments: payments,
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_view_payment = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "user.billing.payments._id": new ObjectID(req.params.id)
         }, {
             //Only return the following fields
             "user.name": 1,
             "user.username": 1,
             "user.address": 1,
             "user.city": 1,
             "user.state": 1,
             "user.zip": 1,
             "user.phone": 1,
             //Return entire invoice object
             "user.billing.payments.$": 1,
             //Return entire plan object
             "user.billing.plan": 1
         }, function(err, result) {
             var payment = result.user.billing.payments[0];
             //Replace all but last 4 characters of card number with *
             var card = "";
             for (var i = 0; i < payment.card.length - 4; i++) {
                 card += "*";
             }
             res.render('employee/employee_view_payment', {
                 id: payment._id,
                 user: result.user.name,
                 date: payment.date,
                 total: payment.amount,
                 status: payment.status,
                 address: result.user.address,
                 city: result.user.city,
                 state: result.user.state,
                 zip: result.user.zip,
                 phone: result.user.phone,
                 payment: payment,
                 card: card + payment.card.slice(-4),
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_view_users = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").find({
             "user.role": "customer"
         }, {
             "user.username": 1,
             "user.name": 1,
         }).toArray(function(err, users) {
             res.render('employee/employee_view_users', {
                 users: users,
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_view_user = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").findOne({
             "_id": new ObjectID(req.params.id)
         }, function(err, result) {
             //Sort invoices by due date
             result.user.billing.invoices.sort(function(a, b) {
                 var date1 = moment(a.due, 'MM/DD/YY');
                 var date2 = moment(b.due, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return -1;
                 } else {
                     return 1;
                 }
             });
             //Sort payments by date paid
             result.user.billing.payments.sort(function(a, b) {
                 var date1 = moment(a.date, 'MM/DD/YY');
                 var date2 = moment(b.date, 'MM/DD/YY');
                 if (date1.isAfter(date2)) {
                     return -1;
                 } else {
                     return 1;
                 }
             });
             var buttons = {};
             switch (result.user.standing) {
                 case "Good Standing":
                     buttons.suspend_action = "suspend";
                     buttons.suspend_text = "Suspend";
                     buttons.close_action = "close";
                     buttons.close_text = "Close";
                     break;
                 case "Suspended":
                     buttons.suspend_action = "activate";
                     buttons.suspend_text = "Activate";
                     buttons.close_action = "close";
                     buttons.close_text = "Close";
                     break;
                 case "Closed":
                     buttons.suspend_action = "suspend";
                     buttons.suspend_text = "Suspend";
                     buttons.close_action = "open";
                     buttons.close_text = "Open";
                     break;
             }
             res.render('employee/employee_view_user', {
                 user: result.user,
                 id: result._id,
                 buttons: buttons,
                 invoices: result.user.billing.invoices,
                 payments: result.user.billing.payments,
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_add_flag = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").update({
             "_id": new ObjectID(req.params.id)
         }, {
             $push: {
                 "user.billing.flags": {
                     "_id": new ObjectID(),
                     "date": moment().format("MM/DD/YY"),
                     "user": req.session.username,
                     "text": req.body.flag
                 }
             },
             $inc: {
                 "user.billing.total": parseFloat(req.body.fee)
             }
         }, function(err) {
             console.log(err);
             res.redirect('/employee/user/' + req.params.id);
         })
     });
 };
 exports.employee_remove_flag = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("accounts").update({
             "_id": new ObjectID(req.params.id)
         }, {
             $pull: {
                 "user.billing.flags": {
                     "_id": new ObjectID(req.params.flag),
                 }
             }
         }, function(err) {
             res.redirect('/employee/user/' + req.params.id);
         })
     });
 };
 exports.employee_user_standing = function(req, res) {
     if (req.params.standing.toLowerCase() === "close") {
         var standing = "Closed";
     } else if (req.params.standing.toLowerCase() === "suspend") {
         var standing = "Suspended"
     } else if (req.params.standing.toLowerCase().toLowerCase() === "activate" || req.params.standing.toLowerCase().toLowerCase() === "open") {
         var standing = "Good Standing"
     }
     if (standing) {
         MongoClient.connect(dbAddress, function(err, db) {
             db.collection("accounts").update({
                 "_id": new ObjectID(req.params.id)
             }, {
                 $set: {
                     "user.standing": standing,
                 },
             }, function(err) {
                 if (standing === "Suspended") {
                     //If account was suspended, insert a new flag
                     db.collection("accounts").update({
                         "_id": new ObjectID(req.params.id)
                     }, {
                         $push: {
                             "user.billing.flags": {
                                 "_id": new ObjectID(),
                                 "date": moment().format("MM/DD/YY"),
                                 "user": req.session.username,
                                 "text": "Service has been suspended"
                             }
                         },
                     }, function(err) {
                         res.redirect('/employee/user/' + req.params.id);
                     });
                 } else {
                     res.redirect('/employee/user/' + req.params.id);
                 }
             });
         });
     } else {
         res.redirect('/');
     }
 };
 exports.customer_new_ticket = function(req, res) {
     res.render('customer/customer_submit_ticket', {
         name: req.session.name,
         username: req.session.username
     });
 };
 exports.customer_submit_ticket = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").insert({
             "username": req.body.username,
             "name": req.body.name,
             "subject": req.body.subject,
             "department": req.body.department,
             "message": req.body.message,
             "date": new Date(),
             "updated": {
                 "time": new Date(),
                 "user": req.body.username,
                 "role": "Client",
             },
             "role": "Client",
             "status": "Open",
             "replies": [],
         }, function(err) {
             res.redirect('/customer/support/tickets/view');
         });
     });
 };
 exports.customer_view_tickets = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").find({
             "username": req.session.username
         }, {
             "name": 1,
             "username": 1,
             "department": 1,
             "subject": 1,
             "date": 1,
             "updated": 1,
             "status": 1,
         }).sort({
             "updated": -1
         }).toArray(function(err, tickets) {
             tickets.forEach(function(ticket) {
                 ticket.date = moment(ticket.date).fromNow();
                 ticket.updated.time = moment(ticket.updated.time).fromNow();
             })
             res.render('customer/customer_view_tickets', {
                 tickets: tickets,
                 name: req.session.name
             });
         });
     });
 };
 exports.customer_view_ticket = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").findOne({
             "_id": new ObjectID(req.params.id)
         }, function(err, ticket) {
             var button_control = "";
             ticket.message = ticket.message.replace(/(\r\n|\n\r|\r|\n)/g, "<br/>");
             ticket.date = moment(ticket.date).fromNow();
             ticket.updated.time = moment(ticket.updated.time).fromNow();
             ticket.replies.forEach(function(reply) {
                 reply.message = reply.message.replace(/(\r\n|\n\r|\r|\n)/g, "<br/>");
                 reply.date = moment(reply.date).fromNow();
             })
             if (ticket.status === "Closed") {
                 button_control = "disabled";
             }
             res.render('customer/customer_view_ticket', {
                 ticket: ticket,
                 button_control: button_control,
                 name: req.session.name,
                 username: req.session.username
             });
         });
     });
 };
 exports.ticket_reply = function(req, res) {
     console.log(req.session);
     if (req.session.role === "customer") {
         var role = "Client"
     } else {
         var role = "Staff";
     }
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").update({
             "_id": new ObjectID(req.params.id)
         }, {
             $set: {
                 "updated.time": new Date(),
                 "updated.user": req.body.username,
                 "updated.role": role
             },
             $push: {
                 "replies": {
                     "_id": new ObjectID(),
                     "username": req.body.username,
                     "name": req.body.name,
                     "date": new Date(),
                     "role": role,
                     "message": req.body.message,
                 }
             }
         }, function(err) {
             res.redirect('/' + req.session.role + '/support/ticket/' + req.params.id);
         })
     });
 };
 exports.employee_view_tickets = function(req, res) {
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").find({}, {
             "name": 1,
             "username": 1,
             "department": 1,
             "subject": 1,
             "date": 1,
             "updated": 1,
             "status": 1,
         }).sort({
             "updated": -1
         }).toArray(function(err, tickets) {
             tickets.forEach(function(ticket) {
                 ticket.date = moment(ticket.date).fromNow();
                 ticket.updated.time = moment(ticket.updated.time).fromNow();
             })
             res.render('employee/employee_view_tickets', {
                 tickets: tickets,
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_view_department_tickets = function(req, res) {
     if (req.params.department === "Technical") {
         var department = "Technical Support";
     } else if (req.params.department === "Billing") {
         var department = "Billing & Sales";
     } else {
         var department = "General Support";
     }
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").find({
             "department": req.params.department
         }, {
             "name": 1,
             "username": 1,
             "department": 1,
             "subject": 1,
             "date": 1,
             "updated": 1,
             "status": 1,
         }).sort({
             "updated": -1
         }).toArray(function(err, tickets) {
             tickets.forEach(function(ticket) {
                 ticket.date = moment(ticket.date).fromNow();
                 ticket.updated.time = moment(ticket.updated.time).fromNow();
             })
             res.render('employee/employee_view_tickets', {
                 department: department,
                 tickets: tickets,
                 name: req.session.name
             });
         });
     });
 };
 exports.employee_view_ticket = function(req, res) {
     if (url.parse(req.url, true).query.msg) {
         var msg = url.parse(req.url, true).query.msg;
     }
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").findOne({
             "_id": new ObjectID(req.params.id)
         }, function(err, ticket) {
             var buttons = {};
             ticket.message = ticket.message.replace(/(\r\n|\n\r|\r|\n)/g, "<br/>");
             ticket.date = moment(ticket.date).fromNow();
             ticket.updated.time = moment(ticket.updated.time).fromNow();
             ticket.replies.forEach(function(reply) {
                 reply.message = reply.message.replace(/(\r\n|\n\r|\r|\n)/g, "<br/>");
                 reply.date = moment(reply.date).fromNow();
             })
             if (ticket.status === "Closed") {
                 buttons.control = "disabled";
                 buttons.text = "Open";
                 buttons.action = "open";
             } else {
                 buttons.control = "";
                 buttons.text = "Close";
                 buttons.action = "close";
             }
             res.render('employee/employee_view_ticket', {
                 msg: msg,
                 ticket: ticket,
                 buttons: buttons,
                 name: req.session.name,
                 username: req.session.username
             });
         });
     });
 };
 exports.employee_ticket_close = function(req, res) {
     if (req.params.action === "open") {
         var status = "Open";
     } else if (req.params.action === "close") {
         var status = "Closed";
     }
     MongoClient.connect(dbAddress, function(err, db) {
         db.collection("tickets").update({
             "_id": new ObjectID(req.params.id)
         }, {
             $set: {
                 "status": status,
             }
         }, function(err) {
             res.redirect('/' + req.session.role + '/support/ticket/' + req.params.id + '?msg=Ticket%20Is%20Now%20' + status);
         })
     });
 };