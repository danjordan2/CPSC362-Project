var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var CronJob = require('cron').CronJob;
var moment = require('moment');
var app = express();
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID
var dbAddress = "mongodb://localhost:27017/standalonetech";
//Partial templates
var partials = {
    customer_top_nav: "partials/customer_top_nav",
    customer_side_nav: "partials/customer_side_nav",
    employee_top_nav: "partials/employee_top_nav",
    employee_side_nav: "partials/employee_side_nav",
    header: "partials/header"
}
//========================================================================
// Module: auth
// Date: 4/14/14
// Programmer: Daniel Jordan
// Purpose: This module handles the authentication of users logged in.
//          When a user is successfully logged in, a session variable is
//          set, with a variable containing their username. This function
//          verifies that the user is logged in, and redirects them to 
//          the login page if they are not. It also serves a purpose in
//          controlling which pages can be accessed by the user. Each user
//          has a role attached to their account, and they can only access
//          pages designated for their role. Customers can only access
//          URL's that begin with /customer/. Employees can only access
//          URL's that begin with /employee/. If they try to access a different
//          URL, the function redirects them back to their section.
// Data Structures: A JSON formatted http request object.
// Additional Algorithms: None
//========================================================================
var auth = function(req, res, next) {
    var path = req.path.split("/");
    //Check if user is logged in
    if (req.session.username) {
        //Only allow users to access their section
        if (path[1] == req.session.role){
            next();
        }
        else{
            res.redirect('/' + req.session.role);  
        } 
    }
    //User isn't logged in
    else{
      res.redirect('/login');  
    } 
};
//========================================================================
// Module: generate_invoice
// Date: 4/14/14
// Programmer: Daniel Jordan
// Purpose: This module handles the generating of monthly invoices. 
//          The function will run every 24 hours at midnight via a node.js Cron
//          module. The function begins by searching the database for all 
//          customers with a billing cycle date matching todays date. 
//          It then iterates through the users returned by the database, 
//          and generates an invoice structure, containing the post date 
//          (today’s date), the due date (2 weeks from the post date), 
//          the total, and the status (due, overdue, paid). The value 
//          containing the prorated monthly balance, is also reset back to 0. 
// Data Structures: JSON structures, containing the user data stored in 
//                  the database. A new JSON structure is inserted into 
//                  the database, containing the data for invoices
// Additional Algorithms: None
//========================================================================
var generate_invoice = new CronJob('00 00 00 * * *', function() {
    MongoClient.connect(dbAddress, function(err, db) {
        db.collection("accounts").aggregate({
            $match: {
                //Find all customers with billing cycle ending today
                "user.role": "customer",
                "user.standing": "Good Standing",
                "user.billing.bill_day": parseInt(moment().format("DD")),
            }
        }, function(err, accounts) {
            //Iterate through users with bill cycle ending today
            accounts.forEach(function(account) {
                db.collection("accounts").update({
                    "user.username": account.user.username
                }, {
                    //Reset monthly total back to 0
                    "$set": {
                        "user.billing.total": 0
                    },
                    //Generate invoice document
                    $push: {
                        "user.billing.invoices": {
                            "_id": new ObjectID(),
                            "posted": moment().format("MM/DD/YY"),
                            "due": moment().add('days', 14).format("MM/DD/YY"),
                            "amount": parseFloat(account.user.billing.total),
                            "status": "due"
                        }
                    }
                }, function() {
                    //Success!
                    console.log("Invoice created at " + moment().format("h:mm:ss"));
                });
            });
        });
    });
    //Run jobs on PST time zone
}, null, true, "America/Los_Angeles");
//========================================================================
// Module: balance_calculator
// Date: 4/14/14
// Programmer: Daniel Jordan
// Purpose: Module handles the monthly balance for each customer. 
//          Each customer has a subscription plan with a daily rate 
//          attached to it. This function will run every 24 hours, 
//          and add the daily rate onto the running monthly total for 
//          the customer. This will allow a user to upgrade or downgrade 
//          their service, and pay a prorated amount for the time they 
//          used the service during that month. 
// Data Structures: JSON structure containing the user account returned
//                  from the database
// Additional Algorithms: None
//========================================================================
var balance_calculator = new CronJob('00 00 00 * * *', function() {
    MongoClient.connect(dbAddress, function(err, db) {
        db.collection("accounts").aggregate({
            $match: {
                "user.role": "customer",
                "user.standing": "Good Standing",
            }
        }, function(err, accounts) {
            accounts.forEach(function(account) {
                db.collection("accounts").update({
                    "user.username": account.user.username
                }, {
                    //Increment daily rate onto running monthly total
                    "$inc": {
                        "user.billing.total": parseFloat(account.user.billing.plan.daily_rate)
                    }
                }, function() {
                    //Success!
                    console.log("Monthly balance updated at " + moment().format("h:mm:ss"));
                });
            });
        });
    });
    //Run jobs on PST time zone
}, null, true, "America/Los_Angeles");
//========================================================================
// Module: flag_overdue_invoices
// Date: 4/16/14
// Programmer: Daniel Jordan
// Purpose: Module handles the flagging of overdue invoices. The module runs
//          every 24 hours at midnight, via a 3rd party node.js cron module.
//          The function first searches the database for any user with an 
//          invoice that is currently due. For each due invoice, the due date
//          is compared to todays date. If the due date is before todays date
//          we can determine the invoice is overdue. Since paid invoices aren't
//          deleted from the database, it also performs a check to make sure
//          the invoice hasn't already been paid or marked as overdue. The 
//          status of the invoice is then updated to "overdue", and a $10 
//          penalty fee is added to the total.        
// Data Structures: JSON structure containing the user's invoice returned
//                  from the database
// Additional Algorithms: None
//========================================================================
var flag_overdue_invoices = new CronJob('00 00 00 * * *', function() {
    var penalty = 10;
    MongoClient.connect(dbAddress, function(err, db) {
        db.collection("accounts").find({
            //Look for users with invoices that are due
            "user.billing.invoices.status": "due"
        }).toArray(function(err, result) {
            result.forEach(function(record) {
                record.user.billing.invoices.forEach(function(invoice) {
                    //Look for invoices due prior to todays date
                    if (moment(invoice.due, 'MM/DD/YY').isBefore(moment().format('MM/DD/YY'))) {
                        //Make sure the invoice hasn't already been paid, or marked overdue
                        if (invoice.status != "paid" && invoice.status != "overdue") {
                            db.collection("accounts").update({
                                "user.billing.invoices._id": new ObjectID(invoice._id)
                            }, {
                                //Set status to overdue
                                $set: {
                                    "user.billing.invoices.$.status": "overdue"
                                },
                                //Add a penalty fee of $10 to the total
                                $inc: {
                                    "user.billing.invoices.$.amount": penalty
                                }
                            }, function(err) {
                                console.log("Invoice ID: " + invoice._id + " is now overdue, $" + penalty + " has been added to the balance");
                            });
                        }
                    }
                });
            });
        });
    });
    //Run jobs on PST time zone
}, null, true, "America/Los_Angeles");
//============================================
// Express middleware
//============================================
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('hogan-express'));
app.set('view engine', 'html');
app.set('partials', partials);
app.use(express.favicon('public/favicon.ico'));
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({
    secret: 'secret'
}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}
//============================================
// Employee pages
//============================================
app.get('/employee', auth, routes.employee);
//Account
app.get('/employee/profile/view', auth, routes.employee_view_profile);
app.post('/employee/profile/view', auth, routes.employee_edit_profile);
app.get('/employee/profile/password', auth, routes.employee_password);
app.post('/employee/profile/password', auth, routes.employee_edit_password);
//Billing
app.get('/employee/billing/invoices', auth, routes.employee_view_invoices);
app.get('/employee/billing/invoice/:id', auth, routes.employee_view_invoice);
app.get('/employee/billing/payments', auth, routes.employee_view_payments);
app.get('/employee/billing/payment/:id', auth, routes.employee_view_payment);
app.get('/employee/users', auth, routes.employee_view_users);
app.get('/employee/user/:id', auth, routes.employee_view_user);
app.post('/employee/user/:id', auth, routes.employee_add_flag);
app.get('/employee/user/:id/flag/:flag/remove', auth, routes.employee_remove_flag);
app.post('/employee/user/:id/:standing', auth, routes.employee_user_standing);
//Support
app.get('/employee/support/tickets/view', auth, routes.employee_view_tickets);
app.get('/employee/support/tickets/:department/view', auth, routes.employee_view_department_tickets);
app.get('/employee/support/ticket/:id', auth, routes.employee_view_ticket);
app.post('/employee/support/ticket/:id/reply', auth, routes.ticket_reply);
app.post('/employee/support/:id/:action', auth, routes.employee_ticket_close);
//============================================
// Customer pages
//============================================
app.get('/customer', auth, routes.customer);
//Account
app.get('/customer/profile/view', auth, routes.customer_view_profile);
app.post('/customer/profile/view', auth, routes.customer_edit_profile);
app.get('/customer/profile/password', auth, routes.customer_password);
app.post('/customer/profile/password', auth, routes.customer_edit_password);
//Billing and services
app.get('/customer/account/invoices', auth, routes.customer_invoices);
app.get('/customer/account/invoice/:id', auth, routes.customer_view_invoice);
app.post('/customer/account/invoice/:id', auth, routes.customer_pay_invoice);
app.get('/customer/account/services', auth, routes.customer_view_services);
app.post('/customer/account/services', auth, routes.customer_edit_services);
app.get('/customer/account/payments', auth, routes.customer_payments);
app.get('/customer/account/payment/:id', auth, routes.customer_view_payment);
app.get('/customer/unauthorized', auth, routes.unauthorized_customer);
//Support
app.get('/customer/support/tickets/new', auth, routes.customer_new_ticket);
app.post('/customer/support/tickets/new', auth, routes.customer_submit_ticket);
app.get('/customer/support/tickets/view', auth, routes.customer_view_tickets);
app.get('/customer/support/ticket/:id', auth, routes.customer_view_ticket);
app.post('/customer/support/ticket/:id/reply', auth, routes.ticket_reply);
//============================================
// Global pages
//============================================
app.get('/', auth, routes.index);
app.get('/login', routes.login);
app.post('/login', routes.login_post);
app.get('/logout', routes.logout);
//============================================
// Server running on port 3000
//============================================
http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
