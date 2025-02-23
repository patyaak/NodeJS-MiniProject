const express = require("express");
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const mongoose = require("mongoose");
mongoose.connect("mongodb://127.0.0.1:27017/miniProject");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

//if user is logged in only then we can view the profile
app.get("/profile", isLoggedIn, async (req, res) => {
  let user = await userModel
    .findOne({ email: req.user.email })
    .populate("posts"); //populating the posts i.e getting the posts of the user
  res.render("profile", { user });
});

//for liking the post
app.get("/like/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");

  //if the post is not liked then increase the number of likes
  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }

  await post.save();
  res.redirect("/profile");
});

// For editing the post - Fix by passing `user`
app.get("/edit/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  let user = await userModel.findOne({ email: req.user.email }); // Fetch user details
  res.render("edit", { post, user }); // Pass user to template
});

//after editing the post updating the post
app.post("/update/:id", isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate(
    { _id: req.params.id },
    { content: req.body.content }
  );
  res.redirect("/profile");
});

//user posting the post
app.post("/post", isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;

  //posting the post with its id and the content
  let post = await postModel.create({
    user: user._id,
    content,
  });

  //need to push the post id
  user.posts.push(post._id);
  await user.save();

  //after posting the post redirecting to the profile page
  res.redirect("/profile");
});

app.post("/register", async (req, res) => {
  let { email, password, username, name, age } = req.body;

  //checking if the email is already used or not
  let user = await userModel.findOne({ email });
  if (user) {
    return res.status(500).send("Email already exists");
  }

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await userModel.create({
        username,
        name,
        email,
        password: hash,
        age,
      });

      //after registration setting up the cookies
      let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.send("registered");
    });
  });
});

app.post("/login", async (req, res) => {
  let { email, password } = req.body;

  let user = await userModel.findOne({ email });
  if (!user) {
    return res.send(`
    <script>
      alert('User not found');
      window.location.href = '/login';
    </script>
    `);
  }

  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.status(200).redirect("/profile");
    } else {
      res.redirect("/login");
    }
  });
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("login");
});

function isLoggedIn(req, res, next) {
  //if token is empty then the user is not logged in
  if (req.cookies.token == "") {
    res.send(`
      <script>
        alert('You must be logged in');
        window.location.href = '/login';
      </script>
    `);
  } else {
    //the user is logged in cookie is cleared
    let data = jwt.verify(req.cookies.token, "shhhh");
    req.user = data;
    next();
  }
}

app.listen(5000);
