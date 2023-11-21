const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const User = require('./server/models/User.js');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

require('dotenv').config();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(expressLayouts);

app.use(cookieParser('CookingBlogSecure'));
app.use(session({
  secret: 'CookingBlogSecretSession',
  saveUninitialized: true,
  resave: true
}));
app.use(flash());
app.use(fileUpload());

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.set('layout', './layouts/main');
app.set('view engine', 'ejs');

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Apply the isAuthenticated middleware for all routes except login and register
app.use((req, res, next) => {
  const allowedRoutes = ['/login', '/register', '/forgot', '/reset'];
  if (!allowedRoutes.includes(req.path)) {
    return isAuthenticated(req, res, next);
  }
  next();
});

// Routes
const routes = require('./server/routes/recipeRoutes.js')
app.use('/', routes);

app.use('/logout', routes);
app.use('/forgot', routes);
app.use('/reset', routes);


app.listen(port, () => console.log(`Listening to port ${port}`));
