require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const findOrCreate = require("mongoose-findorcreate");

//For Authentification & Security
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");

//Express session
app.use(
  session({
    secret: "This is a little secret.",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

///////////////Database///////////////
mongoose.connect(process.env.DATABASE_CONNECTION);

//Secret Post Schema
const secretPostSchema = new mongoose.Schema({
  content: String,
  date: {
    type: Date,
    default: Date.now,
  },
});

//User Schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String,
  secretPost: [secretPostSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

//Model
const User = new mongoose.model("User", userSchema);
/////////////////////////////////////

//Passport session
passport.use(User.createStrategy());

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, {
      id: user.id,
      username: user.username,
      picture: user.picture,
    });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

//Google Auth with Passport strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secretly",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

//Render the default page
app.get("/", (req, res) => {
  const data = {
    image: "/images/logo.png",
  };
  res.render("home", { data: data });
});

////Google authentication
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secretly",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect Secretly main page.
    res.redirect("/secretly");
  }
);

//Render the signup page
app.get("/signup", (req, res) => {
  const data = {
    image: "/images/image-01.svg",
  };
  res.render("signup", { data: data });
});

//Render the login page
app.get("/login", (req, res) => {
  const data = {
    image: "/images/image-02.svg",
  };
  res.render("login", { data: data });
});

//Render the main secretly page
app.get("/secretly", (req, res) => {
  const data = {
    image: "/images/logo-02.png",
  };
  find();
  async function find() {
    await User.aggregate([
      { $unwind: "$secretPost" }, // deconstruct the secretPost array for each user in order to sort all the posts by date
      { $sort: { "secretPost.date": -1 } }, // sort the posts by date in descending order
    ])
      .then((foundUsers) => {
        if (foundUsers) {
          res.render("secretly", { usersPosts: foundUsers, data: data });
        }
      })
      .catch((err) => {
        res.send(err);
      });
  }
});

//Submit page
app.get("/submit", (req, res) => {
  const data = {
    image: "/images/logo.png",
  };

  if (req.isAuthenticated()) {
    res.render("submit", { data: data });
  } else {
    res.redirect("/login");
  }
});

//To logout
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});

//Register a new user and redirect to the website
app.post("/signup", (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  User.register({ username: email, active: false }, password, (err, user) => {
    if (err) {
      console.log(err);
      res.redirect("/signup");
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/secretly");
      });
    }
  });
});

//Login user
app.post("/login", (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  const user = new User({
    username: email,
    password: password,
  });

  req.login(user, (err) => {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/secretly");
      });
    }
  });
});

//To post a secret post
app.post("/submit", (req, res) => {
  const submittedPost = req.body.secretPost;
  const userId = req.user.id;

  User.findById(userId)
    .then((foundUser) => {
      if (foundUser) {
        const newSecretPost = { content: submittedPost };
        foundUser.secretPost.push(newSecretPost);
        foundUser.save().then(() => {
          res.redirect("/secretly");
        });
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

app.listen(port, () => {
  console.log(`The server is listening on the port ${port}`);
});
