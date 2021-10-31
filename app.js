const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const session =require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const bcrypt= require('bcryptjs');
const app= express();
const mongoose = require('mongoose');
const formidable = require('formidable');
const { response } = require('express');
const socketIO = require('socket.io');
const http = require('http');


app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
//config for authentication
app.use(cookieParser());
app.use(session({
    secret: 'mysecret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

const{requireLogin,ensureGuest} = require('./helpers/authHelper');
const {upload} = require('./helpers/aws');

require('./passport/local');
require('./passport/facebook');
app.use((req,res,next) => {
    res.locals.user = req.user || null;
    next();
});
//load files
const keys = require('./config/keys');
//load stripe
const stripe = require('stripe')(keys.StripeSecretKey);
//load collections
const User = require('./models/user');
const Contact = require('./models/contact');
const Car = require('./models/car')
const Chat = require('./models/chat');
const Budget= require('./models/budget'); 
//connect to mongoDB
mongoose.connect(keys.MongoDB,() => {
    console.log('MongoDB is connected');
}).catch((err) => {
    console.log(err);
});

app.engine('handlebars',exphbs({
    defaultLayout: 'main'
}));
app.set('view engine','handlebars');

app.use(express.static('public'));

const port = process.env.PORT || 3000;

app.get('/',ensureGuest,(req,res) => {
    res.render('home');

});
app.get('/about',ensureGuest,(req,res) => {
    res.render('about',{
        title: 'About'
    });
});
app.get('/contact',requireLogin,(req,res) => {
    res.render('contact',{
        title:'Contact Us'
    });
});
app.post('/contact',(req,res) => {
    console.log(req.body);
    const newContact = {
        name: req.user._id,
        message: req.body.message,
    }
    new Contact(newContact).save((err,user) => {
        if(err) {
            throw err;
        }else{
            console.log('Received a message from user',user);
        }
    });
});
app.get('/signup',ensureGuest,(req,res) => {
    res.render('signupForm',{
        title:'Register'
    });
});
app.post('/signup', ensureGuest,(req,res) => {
    console.log(req.body);
    let errors =[];

    if (req.body.password !== req.body.password2){
        errors.push({text: 'Password does not match'});
    }

    if (req.body.password.length < 5){
        errors.push({text: 'Password must be atleast 5 characters'});
    }

    if (errors.length > 0){
        res.render('signupForm',{
        errors:errors,
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        password: req.body.passsword,
        password2: req.body.password2,
        email: req.body.email
        })

    }else{
        User.findOne({email:req.body.email})
        .then((user) => {
            if (user) {
                let errors = [];
                errors.push({text: 'Email already exists'});
                res.render('signupForm',{
                    errors:errors,
                    firstname: req.body.firstname,
                    lastname: req.body.lastname,
                    password: req.body.passsword,
                    password2: req.body.password2,
                    email: req.body.email
                });

            }else{
                //encrypt pass
                let salt = bcrypt.genSaltSync(10);
                let hash = bcrypt.hashSync(req.body.password,salt);                
                const newUser = {
                    firstname: req.body.firstname,
                    lastname: req.body.lastname,
                    email: req.body.email,
                    password: hash
                }

                new User(newUser).save((err,user) => {

                    if(err){
                      throw err;
                    }

                    if(user){
                        let success = [];
                        success.push({text: 'You have successfully created an account'})
                        res.render('loginForm',{
                            success:success
                        })
                    }
                })
            }
        })
    }
});
app.get('/displayLoginForm' ,ensureGuest,(req,res) => {
    res.render('loginForm', {
        title: 'Login'
    });
});
app.post('/login',passport.authenticate('local',{
    successRedirect: '/profile', 
    failureRedirect: '/loginErrors'
}));

app.get('/auth/facebook',passport.authenticate('facebook',{
    scope: ['email']
}));

app.get('/auth/facebook/callback',passport.authenticate('facebook', {
    successRedirect: '/profile',
    failureRedirect:'/'
}))

//display profile
app.get('/profile',requireLogin,(req,res) =>{
    User.findById({_id:req.user._id})
    .then((user) => {
        res.render('profile' ,{
            user:user,
            title:'Profile'
        });
    });
});
app.get('/loginErrors',(req,res) => {
    let errors =[];
    errors.push({text: 'User not found or Password Incorrect'});
    res.render('loginForm', {
        errors:errors,
        title: 'Error'
    });
});
//list a car
app.get('/listCar', requireLogin,(req,res) => {
    res.render('listCar', {
        title: 'Listing'
    });
});

app.post('/listCar',requireLogin,(req,res) => {
    const newCar = {
        owner: req.user._id,
        make: req.body.make,
        model: req.body.model,
        year: req.body.year,
        type: req.body.type
    }
    new Car(newCar).save((err,car) => {
        if (err) {
            throw err;

        }
        if (car){
            res.render('listCar2',{
                title: 'Finish',
                car:car
            });
        }
    })
});
app.post('/listCar2',requireLogin,(req,res) => {
    Car.findOne({_id:req.body.carID,owner:req.user._id})
    .then((car) => {
        let imageUrl= {
            imageUrl: `https://car-rental-app11.s3.amazonaws.com/${req.body.image}`
        };
        car.pricePerHour = req.body.pricePerHour;
        car.pricePerWeek = req.body.pricePerWeek;
        car.location = req.body.location;
        car.picture = `https://car-rental-app11.s3.amazonaws.com/${req.body.image}`;
        car.image.push(imageUrl);      
        car.save((err,car) => {
            if (err) {
                throw err;
            }
            if (car) {
                res.redirect('/showcars');
            }
        })

    })
});
app.get('/showCars',requireLogin,(req,res) => {
    Car.find({})
    .populate('owner')
    .sort({date:'desc'})
    .then((cars) => {
        res.render('showCars',{
            cars:cars
        })

    })
});

app.post('/uploadImage',requireLogin,upload.any(),(req,res) => {
    const form = new formidable.IncomingForm();
    form.on('file',(field,file) => {
        console.log(file);
    });
    form.on('error',(err) => {
        console.log(err);
    });
    form.on('end',() => {
        console.log('Image recieved succesfully');

    });
    form.parse(req);
});

app.get('/logout', (req,res) => {
    User.findById({_id:req.user._id})
    .then((user) => {
         user.online = false;
         user.save((err,user) => {
             if (err) {
                 throw err; 
             }
             if (user) {
                 req.logout();
                 res.redirect('/');
             }
         });
    });
});
app.get('/openGoogleMap',(req,res)=>{
    res.render('googlemap');
});
//display one car info
app.get('/displayCar/:id', (req,res)=>{
    Car.findOne({_id:req.params.id}).then((car)=>{
        res.render('displayCar',{
            car:Car
        });
    }).catch((err)=>{console.log(err)});
})
//open owner profile page
app.get('/contactOwner/:id', (req,res)=>{
    User.findOne({_id:req.params.id})
    .then((owner) => {
    res.render('/ownerProfile',{
        owner:owner
    })
    }).catch((err)=>{console.log(err)});
})
//renting a car
app.get('/RentCar/:id', (req,res)=>{
    Car.findOne({_id:req.params.id})
    .then((car) => {
    res.render('/calculate',{
        car:car
    })
    }).catch((err)=>{console.log(err)});
})
//alculate total POST request
app.post('/calculateTotal/:id', (req,res)=>{
    Car.findOne({_id:req.params.id})
    .then((car) => {
    console.log(req.body);
    console.log('Type is', typeOf(req.body.week))
    console.log('Type is', typeOf(req.body.hour))
    var hour = parseInt(req.body.hour)
    var week = parseInt(req.body.week)
    console.log('Type of hour is', typeOf(hour))
    var totalHours = hour* car.pricePerHour;
    var totalWeeks = week* car.pricePerWeek;
    var total = totalHours+totalWeeks;
    console.log('Total is ', total);
    //create a budget
    const budget = {
        carID: req.params.id,
        total: total,
        renter: req.user._id,
        date: new Date()
    }
    new Budget(budget).save((err,budget) => {
        if(err) {
            console.log(err);
        }
        if(budget) {
            Car.findOne({_id:req.params.id})
            .then((car) => {
                //caclualte total for stripe
                var stripeTotal = budget.total*100;
            res.render('checkout', {
                budget:budget,
                car: car,
                StripePublishableKey: keys.StripePublishableKey,
                stripeTotal: stripeTotal
            })
            }).catch((err) =>{console.log(err)});
        }
    })
    })
})
//charge client
app.post('/chargeRenter/:id', (req,res) => {
    Budget.findOne({_id:req.params.id})
    .populate('renter')
    .then((budget) => {
        const amount = budget.total*100;
        stripe.customer.create({
            email: req.body.stripeEmail,
            source: req.body.stripeToken 
        })
        .then((customer) => {
            stripe.charges.create({
                amount: amount,
                descripion: `$${budget.total} for renting a car`,
                currency: 'usd',
                customer: customer.id,
                receipt_email: custoemr.email
            },(err,charge) => {
                if(err) {
                    console.log(err);
                }
                if (charge) {
                    console.log(charge);
                    res.render('success',{
                        charge: charge,
                        budget: budget
                    })
                }
            })
        }).catch((err) => {console.log(err)})
    }).catch((err) => {console.log(err)});
})
//socket connection
const server = http.createServer(app);
const io=socketIO(server);
// connect to client
io.on('connection',(socket) => {
    console.log('Connected to Client');
    //handle chat room route
    app.get('/chatOwner/:id', (req,res)=>{
        Chat.findOne({sender:req.params.id,receiver:req.params._id})
        .then((chat) => {
            if(chat) {
                chat.date=new Date(),
                chat.senderRead= false;
                chat.receiverRead= true;
                chat.save()
                .then((chat) => {
                    res.redirect(`/chat/${chat._id}`);
                }).catch((err) => {console.log(err)});
            }else {
                Chat.findOne({sender:req.user._id,receiver:req.params.id})
        .then((chat)=> {
            if(chat) {
                chat.senderRead= true;
                chat.receiverRead= false;
                chat.date=new Date()
                chat.save()
                .then((chat) => {
                    res.redirect(`/chat/${chat._id}`);
                }).catch((err) => {console.log(err)});
            } else {
                const newChat = {
                    sender: req.user._id,
                    receiver: req.params.id,
                    date: new Date()
                }
                new Chat(newChat).save().then((chat) => {
    res.redirect(`/chat/${chat._id}`);
}).catch((err) => {console.log(err)});
            }
        }).catch((err) => {console.log(err)});
    }
    }).catch((err) => {console.log(err)});
});
//handle /chat/chat ID route
app.get('/chat/:id', (req,res) => {
    Chat.findOne({_id:req.params.id})
    .populate('sender')
    .populate('receiver')
    .populate('dialogue.sender')
    .populate('dialogue.receiver')
    .then((chat) => {
        res.render('chatRoom', {
            chat:chat
        })
    }).catch((err) => {console.log(err)});
})
//post request to /chat/ID
app.post('/chat/:id', (req,res) => {
    Chat.findById({_id:req.params.id})
    .populate('sender')
    .populate('receiver')
    .populate('dialogue.sender')
    .populate('dialogue.receiver')
    .then((chat) => {
        const newDialogue = {
            sender: req.user._id,
            date: new Date(),
            senderMessage: req.body.message
        }
        chat.dialogue.push(newDialogue)
        chat.save((err,chat) => {
            if(err) {
                console.log(err);
            }
            if (chat) {
                Chat.findOne({_id:chat._id})
                .populate('sender')
                .populate('receiver')
                .populate('dialogue.sender')
                .populate('dialogue.receiver')
                .then((chat) => {
                    res.render('chatRoom', {chat:chat});
                }).catch((err) => {console.log(err)});
            }
        })
    }).catch((err) => {console.log(err)});
})
//listen to ObjectID event
socket.on('ObjectID',(oneCar) => {
    console.log('One Car is ',oneCar);
    Car.findOne({
        owner: oneCar.userID,
        _id: oneCar.carID
    })
    .then((car)=>{
        socket.emit('car', car);
    });
});
//find cars and send them to browser for map
Car.find({}).then((cars)=>{
    socket.emit('allcars', {cars:cars});
}).catch((err) => {
    console.log(err);
});
// listen to event to recieve lat and lng
socket.on('LatLng',(data)=>{
console.log(data);
});
//find a car object and update lat and lng
Car.findOne({owner:data.car.owner})
.then((car) => {
    car.coords.lat = data.data.results[0].geometry.location.lat;
    car.coords.lng = data.data.results[0].geometry.location.lng;
    car.save((err,car)=>{
        if(err){
            throw err;   
        }
        if(car){
            console.log('Car lat and lng is updated!')
        }
    })
}).catch((err)=>{
    console.log(err);
})
 //listen to disconnection
    socket.on('disconnect', (socket) => {
    console.log('Disconnected from Client');
});
});
server.listen(port,() => {
    console.log(`Server is running on port ${port}`);
});