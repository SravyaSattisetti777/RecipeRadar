const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const bcrypt = require('bcrypt');


const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  name: String,
  password: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });


userSchema.pre('save', async function (next) {
    try {
      if (!this.isModified('password')) {
        return next();
      }
  
      const hashedPassword = await bcrypt.hash(this.password, 10);
      this.password = hashedPassword;
  
      next();
    } catch (error) {
      next(error);
    }
});


userSchema.statics.findByToken = async function (token) {
  try {
    const user = await this.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    return user;
  } catch (error) {
    throw new Error('Error finding user by token: ' + error.message);
  }
};

module.exports = mongoose.model('User', userSchema);
