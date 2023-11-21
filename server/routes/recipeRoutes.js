const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const Recipe = require('../models/Recipe');


router.get('/login', (req, res) => {
  res.render('login', { alert: req.query.alert });
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login?alert=Invalid%20credentials.%20Please%20try%20again.',
    failureFlash: true,
}), (req, res) => {
    console.log(req.user); 
});


router.get('/register', (req, res) => {
  res.render('register', { alert: req.query.alert });
});

router.post('/register', async (req, res) => {
    try {
      const existingUser = await User.findOne({ email: req.body.email });
  
      if (existingUser) {
        return res.redirect('/register?alert=Email%20already%20exists.%20Please%20choose%20another%20Email%20(or)%20Login.');
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 10);
  
      const newUser = new User({
        email: req.body.email,
        username: req.body.username,
        password: hashedPassword,
        name: req.body.name,
      });
  
      await User.register(newUser, req.body.password);
  
      req.login(newUser, (err) => {
        if (err) {
          return res.redirect('/login?alert=Error%20logging%20in%20after%20registration.');
        }
        return res.redirect('/login?alert=Registration%20successful.%20Please%20login.');
      });
    } catch (err) {
      res.redirect('/register?alert=' + encodeURIComponent(err.message));
    }
});
  


router.get('/logout', (req, res) => {
    res.render('logout');
  });
  
  router.post('/logout', (req, res) => {
    req.logout(function(err) {
      if (err) {
        return next(err);
      }
      res.redirect('/login');
    });
  });


  router.get('/forgot', (req, res) => {
    res.render('forgot', { alert: req.query.alert });
});


router.get('/forgot', (req, res) => {
    res.render('forgot', { alert: req.query.alert });
  });
  
  router.post('/forgot', async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email });
  
      if (!user) {
        return res.redirect('/forgot?alert=User%20not%20found.');
      }
  
      // Generate a random token
      const token = crypto.randomBytes(20).toString('hex');
      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + 1); // Expires in 1 hour
  
      // Update user with token and expiration time
      user.resetPasswordToken = token;
      user.resetPasswordExpires = expirationTime;
      await user.save();
  
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'sravyasattisetti887@gmail.com', // Replace with your Gmail address
          pass: 'fljw pncq czma qmek', // Replace with your Gmail password
        },
      });
      
      const resetLink = `http://${req.headers.host}/reset?token=${token}`;
      
      const mailOptions = {
        from: 'sravyasattisetti887@gmail.com', // Replace with your Gmail address
        to: user.email,
        subject: 'Reset your password',
        // Include the link in the email content
        text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account of Recipe-Radar website.\n\n`
          + `Please click the following link to reset your password:\n`
          + `${resetLink}\n\n`
          + `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
      };
      
      await transporter.sendMail(mailOptions);
      
      res.redirect('/login?alert=Reset%20email%20sent.%20Please%20check%20your%20email%20for%20instructions.');
    } catch (error) {
      console.error('Error sending email:', error);
      res.redirect('/forgot?alert=' + encodeURIComponent('Error sending email: ' + error.message));
    }
});

router.get('/reset', async (req, res) => {
  try {
    const token = req.query.token;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is not expired
    });

    if (!user) {
      return res.redirect('/login?alert=Invalid%20token.%20Please%20try%20again.');
    }

    // Pass the token to the reset.ejs view
    res.render('reset', { token });
  } catch (error) {
    console.error('Error rendering reset page:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/reset', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render('reset', { error: 'Passwords do not match' });
  }

  try {
    const user = await User.findByToken(token);

    if (!user) {
      return res.render('reset', { error: 'Invalid or expired token' });
    }

    user.setPassword(newPassword, async (err) => {
      if (err) {
        return res.render('reset', { error: 'Error updating password' });
      }

      try {
        await user.save(); 
        res.redirect('/login');
      } catch (saveError) {
        return res.render('reset', { error: 'Error saving user: ' + saveError.message });
      }
    });
  } catch (error) {
    return res.render('reset', { error: 'Error finding user: ' + error.message });
  }
});

router.get('/update/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).send('Recipe not found');
    }
    res.render('updateRecipe', { recipe }); // Assuming you have an updateRecipe.ejs view for updating the recipe
  } catch (err) {
    res.status(500).send('Error fetching recipe');
  }
});


// POST route to update the specific recipe
// router.post('/update/:id', async (req, res) => {
//   try {
//     const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     if (!recipe) {
//       return res.status(404).send('Recipe not found');
//     }
//     res.redirect('/'); // Redirect to the home page or wherever appropriate after update
//   } catch (err) {
//     res.status(500).send('Error updating recipe');
//   }
// });

router.post('/update/:id', async (req, res) => {
  try {
    const recipeId = req.params.id;
    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).send('Recipe not found');
    }

    // Update the recipe fields
    recipe.name = req.body.name;
    recipe.description = req.body.description;
    recipe.category = req.body.category;
    recipe.ingredients = req.body.ingredients;

    // Check if a new image is uploaded
    if (req.files && req.files.image) {
      let imageUploadFile = req.files.image;
      let newImageName = Date.now() + imageUploadFile.name;
      let uploadPath = require('path').resolve('./') + '/public/uploads/' + newImageName;

      // Move the new image to the uploads folder
      await imageUploadFile.mv(uploadPath);

      // Update the recipe's image field with the new image name
      recipe.image = newImageName;
    }

    // Save the updated recipe
    await recipe.save();

    res.redirect('/'); // Redirect to the home page or wherever appropriate after update
  } catch (err) {
    console.error(err); // Log the specific error for debugging
    res.status(500).send('Error updating recipe');
  }
});


// Delete recipe
router.post('/delete/:id', async (req, res) => {
  try {
    await Recipe.findByIdAndDelete(req.params.id).exec();
    res.redirect('/');
  } catch (err) {
    res.status(500).send(err);
  }
});

router.get('/cancel-update/:recipeId', (req, res) => {
  const recipeId = req.params.recipeId;
  // Logic to revert the changes, e.g., fetching the original recipe data
  // Then redirect to the recipe page
  res.redirect(`/recipe/${recipeId}`); // Replace '/recipe/:recipeId' with your actual recipe page route
});

router.get('/', recipeController.homepage);
router.get('/recipe/:id', recipeController.exploreRecipe);
router.get('/categories', recipeController.exploreCategories);
router.get('/categories/:id', recipeController.exploreCategoriesById);
router.post('/search', recipeController.searchRecipe);
router.get('/explore-latest', recipeController.exploreLatest);
router.get('/explore-random', recipeController.exploreRandom);
router.get('/submit-recipe', recipeController.submitRecipe);
router.post('/submit-recipe', recipeController.submitRecipeOnPost);

module.exports = router;