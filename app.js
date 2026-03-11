require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

// Models
const Product = require('./models/Product');
const User = require('./models/User');

const app = express();

// --- 1. CONFIGURATION & MIDDLEWARE ---
app.set('view engine', 'ejs');

// Public folder ki setting ko mazeed mazboot banaya hai
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true })); 

app.use(session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: false
}));

// Auth Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// --- 2. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Database Connected! ✅"))
.catch(err => console.log("DB Error: ", err));


// --- 3. AUTH ROUTES ---
app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, email, password: hashedPassword });
        res.redirect('/login');
    } catch (err) {
        res.send("Error during signup: " + err.message);
    }
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            res.redirect('/products');
        } else {
            res.send("Invalid email or password");
        }
    } catch (err) {
        res.status(500).send("Login Error");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


// --- 4. CART ROUTES ---
app.post('/add-to-cart/:id', (req, res) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    const productId = req.params.id;
    const existingItem = req.session.cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        req.session.cart.push({ id: productId, qty: 1 });
    }
    res.redirect('/cart');
});

app.get('/cart', async (req, res) => {
    const cart = req.session.cart || [];
    const productsInCart = [];
    let total = 0;
    try {
        for (let item of cart) {
            const product = await Product.findById(item.id);
            if (product) {
                productsInCart.push({ 
                    name: product.name, 
                    price: product.price, 
                    qty: item.qty,
                    subtotal: product.price * item.qty 
                });
                total += product.price * item.qty;
            }
        }
        res.render('cart', { products: productsInCart, total });
    } catch (err) {
        res.status(500).send("Error loading cart");
    }
});


// --- 5. PRODUCT ROUTES ---
app.get(['/', '/products'], async (req, res) => {
    try {
        const perPage = 5; 
        const page = parseInt(req.query.page) || 1;
        let query = {};
        if (req.query.search) {
            query = {
                $or: [
                    { name: new RegExp(req.query.search, 'i') },
                    { category: new RegExp(req.query.search, 'i') }
                ]
            };
        }
        const products = await Product.find(query)
            .skip((perPage * page) - perPage)
            .limit(perPage);
        const count = await Product.countDocuments(query);
        res.render('index', { 
            products,
            current: page,
            pages: Math.ceil(count / perPage),
            search: req.query.search || ''
        });
    } catch (err) {
        res.status(500).send("Error fetching products");
    }
});

app.get('/add-product', isAuthenticated, (req, res) => res.render('add-product'));
app.post('/add-product', isAuthenticated, async (req, res) => {
    try {
        await Product.create(req.body);
        res.redirect('/products');
    } catch (err) {
        res.status(500).send("Error adding product");
    }
});

app.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send("Product not found");
        res.render('details', { product });
    } catch (err) {
        res.status(500).send("Error loading details");
    }
});


// --- 6. SEED ROUTE ---
app.get('/seed', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error("Database not connected.");
        }
        await Product.deleteMany({}); 

        // Paths ko Relative rakha hai aur filenames exact match hain
        const seedProducts = [
            { name: "Mechanical Keyboard", price: 5500, category: "Tech", image: "assets/image/tech/keyboard.png", description: "Blue switch mechanical keyboard.", stock: 10 },
            { name: "Wireless Headphones", price: 4500, category: "Tech", image: "assets/image/tech/headphones.png", description: "Noise cancelling headphones.", stock: 8 },
            { name: "Classic Interior Sofa", price: 45000, category: "Interior", image: "assets/image/interior/sofa.png", description: "Stylish sofa.", stock: 5 },
            { name: "Oppo A23", price: 500, category: "Tech", image: "assets/image/tech/image 33.png", description: "Oppo A23 , 3GB RAM 128GB Storage", stock: 100 },
            { name: "Electric Lamp", price: 2500, category: "Home", image: "assets/image/interior/Electric Lamp.png", description: "Modern LED lamp.", stock: 20 },
            { name: "Juicer Blender", price: 8500, category: "Appliances", image: "assets/image/tech/electric juicer.png", description: "High speed juicer.", stock: 5 },
            { name: "Indoor Plant", price: 1200, category: "Home", image: "assets/image/interior/image 89.png", description: "Air-purifying plant.", stock: 50 },
            { name: "Samsung Galaxy S23", price: 250000, category: "Tech", image: "assets/image/tech/image 23.png", description: "Flagship Samsung mobile.", stock: 3 },
            { name: "Smart Watch", price: 12000, category: "Tech", image: "assets/image/tech/8.png", description: "Fitness tracking watch.", stock: 15 },
            { name: "Digital Camera", price: 95000, category: "Tech", image: "assets/image/tech/6.png", description: "Professional DSLR.", stock: 4 }
        ];

        await Product.insertMany(seedProducts);
        res.send("<h1>Database Reset & Updated! ✅</h1><p>Check your shop now.</p><a href='/products'>Go to Shop</a>");
    } catch (err) {
        res.status(500).send("Seed error: " + err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));