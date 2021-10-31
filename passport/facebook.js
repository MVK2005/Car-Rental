const passport = require('passport');
const facebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/user');
const keys = require('../config/keys');

passport.serializeUser((user,done) => {
    done(null,user.id);
});

passport.deserializeUser((id,done) => {
    User.findById(id,(err,user) => {
        done(err,user);
    });
});

passport.use(new facebookStrategy({
    clientID: keys.FBAppID,
    clientSecret: keys.FBAppSECRET,
    callbackURL: 'http://localhost:3000/auth/facebook/callback',
    profileFields: ['email','name','displayName','photos']
},(accessToken,refresthToken,profile,done) => {
    console.log(profile);
    User.findOne({facebook: profile.id},(err,user) => {

        if (err) {
            return done(err);
        }

        if (user) {
            return done(null,user);
        }

        else{
            const newUser={
                facebook: profile.id,
                firstname: profile.name.giveName,
                lastname: profile.name.familyName,
                image: `https://graph.facebook.com/${profile.id}/picture?type=large`,
                email: profile.emails[0].value
            }
            
            new User(newUser).save((err,user) => {
                if (err) {
                    return done(err);
                }
                if (user) {
                    return done(null,user);
                }
            })
        }
    })
}));