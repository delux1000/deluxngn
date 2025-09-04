const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();
const PORT = 6000;
const USERS_FILE = path.join(__dirname, "users.json");

// Ensure users.json file exists
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser());
app.use(cors());

// Read user data
const readUsers = () => {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
};

// Write user data
const writeUsers = (data) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
};

// **USER REGISTRATION**
app.post("/register", (req, res) => {
    const { fullName, phone, pin } = req.body;
    let users = readUsers();
    if (users.some(user => user.phone === phone)) {
        return res.status(400).json({ message: "Phone number already registered" });
    }
    const newUser = {
        fullName,
        phone,
        pin,
        balance: 90000, // Registration bonus
        transactions: []
    };
    users.push(newUser);
    writeUsers(users);
    res.cookie("phone", phone, { httpOnly: true, maxAge: 3600000 });
    res.json({ message: "Registration successful!", redirect: "/dashboard.html" });
});

// **USER LOGIN**
app.post("/login", (req, res) => {
    const { phone, pin } = req.body;
    let users = readUsers();
    const user = users.find(user => user.phone === phone && user.pin === pin);
    if (!user) return res.status(400).json({ message: "Invalid phone or PIN" });
    res.cookie("phone", phone, { httpOnly: true, maxAge: 3600000 });
    res.json({ message: "Login successful", redirect: "/dashboard.html" });
});

// **DASHBOARD DATA**
app.get("/dashboard", (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) return res.status(401).json({ message: "Unauthorized. Please log in." });
    let users = readUsers();
    let user = users.find(user => user.phone === phone);
    if (!user) return res.status(400).json({ message: "User not found" });
    res.json({ fullName: user.fullName, balance: user.balance });
});

// **GET USER BALANCE**
app.get("/balance", (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) return res.status(401).json({ message: "Unauthorized. Please log in." });
    let users = readUsers();
    let user = users.find(user => user.phone === phone);
    if (!user) return res.status(400).json({ message: "User not found" });
    res.json({ balance: user.balance });
});

// **TRANSFER MONEY**
app.post("/transfer", (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) return res.status(401).json({ message: "Unauthorized. Please log in." });
    const { receiverName, receiverAccount, bank, amount } = req.body;
    let users = readUsers();
    let sender = users.find(user => user.phone === phone);
    if (!sender) return res.status(400).json({ message: "User not found" });
    const transferAmount = parseFloat(amount);
    if (sender.transactions.length === 0 && transferAmount < 100000) {
        return res.status(400).json({ message: "First transfer must be at least ₦100,000" });
    }
    if (transferAmount > sender.balance) {
        return res.status(400).json({
            message: `Insufficient funds! Kindly deposit to your account from your dashboard.`,
            depositRedirect: "/dashboard.html"
        });
    }
    sender.balance -= transferAmount;
    sender.transactions.push({
        type: "debit",
        amount: transferAmount,
        receiver: receiverName,
        bank,
        account: receiverAccount,
        date: new Date().toLocaleString()
    });
    writeUsers(users);
    res.json({ message: "Transfer successful", newBalance: sender.balance });
});

// **TRANSACTION HISTORY**
app.get("/history", (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) return res.status(401).json({ message: "Unauthorized. Please log in." });
    let users = readUsers();
    let user = users.find(user => user.phone === phone);
    if (!user) return res.status(400).json({ message: "User not found" });
    res.json(user.transactions);
});

// **LOGOUT**
app.post("/logout", (req, res) => {
    res.clearCookie("phone");
    res.json({ message: "Logged out successfully" });
});

// ✅ **WIRE FUNDS (Admin/Deposit)**
app.post("/wire", (req, res) => {
    const { phone, amount } = req.body;
    let users = readUsers();
    let user = users.find(user => user.phone === phone);
    if (!user) return res.status(400).json({ message: "User not found" });

    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
        return res.status(400).json({ message: "Invalid deposit amount" });
    }

    user.balance += creditAmount;
    user.transactions.push({
        type: "credit",
        amount: creditAmount,
        sender: "Wire Deposit",
        date: new Date().toLocaleString()
    });

    writeUsers(users);
    res.json({ message: `₦${creditAmount.toLocaleString()} credited to ${phone}` });
});

// **START SERVER**
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
