const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const bodyParser = require("body-parser")
const fs = require("fs").promises
const path = require("path")
const { v4: uuidv4 } = require("uuid")

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = "chase_bank_secret_key_2024"

// Middleware
app.use(cors())
app.use(bodyParser.json())
app.use(express.static("public"))

// Data file paths
const DATA_DIR = path.join(__dirname, "data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const TRANSACTIONS_FILE = path.join(DATA_DIR, "transactions.json")
const RECEIPTS_FILE = path.join(DATA_DIR, "receipts.json")

// Initialize data files
async function initializeDataFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })

    // Initialize users.json
    try {
      await fs.access(USERS_FILE)
    } catch {
      await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2))
    }

    // Initialize transactions.json
    try {
      await fs.access(TRANSACTIONS_FILE)
    } catch {
      await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify([], null, 2))
    }

    // Initialize receipts.json
    try {
      await fs.access(RECEIPTS_FILE)
    } catch {
      await fs.writeFile(RECEIPTS_FILE, JSON.stringify([], null, 2))
    }
  } catch (error) {
    console.error("Error initializing data files:", error)
  }
}

// Helper functions
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

function generateAccountNumber() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString()
}

function generateTransactionId() {
  return "TXN" + Date.now() + Math.floor(Math.random() * 1000)
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" })
    }
    req.user = user
    next()
  })
}

// Routes

// User Registration
app.post("/api/register", async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" })
    }

    const users = await readJsonFile(USERS_FILE)

    // Check if user already exists
    const existingUser = users.find((u) => u.email === email || u.username === username)
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create new user
    const newUser = {
      id: uuidv4(),
      fullName,
      username,
      email,
      password: hashedPassword,
      accountNumber: generateAccountNumber(),
      balance: 0,
      status: "Active",
      createdAt: new Date().toISOString(),
      totalDeposits: 0,
      totalWithdrawals: 0,
    }

    users.push(newUser)
    await writeJsonFile(USERS_FILE, users)

    // Generate JWT token
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: "24h" })

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        accountNumber: newUser.accountNumber,
        balance: newUser.balance,
        status: newUser.status,
      },
      token,
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// User Login
app.post("/api/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: "Email/Username and password are required" })
    }

    const users = await readJsonFile(USERS_FILE)
    const user = users.find((u) => u.email === emailOrUsername || u.username === emailOrUsername)

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" })

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        status: user.status,
        totalDeposits: user.totalDeposits || 0,
        totalWithdrawals: user.totalWithdrawals || 0,
      },
      token,
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Admin Login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { adminKey, email, password } = req.body

    // Check admin key
    if (adminKey !== "kfhiwngaobegsnsvshsbsjdhhd") {
      return res.status(401).json({ error: "Invalid admin key" })
    }

    // Check admin credentials
    if (email !== "admincbl@gmail.com" || password !== "Admincbl001@#$&_") {
      return res.status(401).json({ error: "Invalid admin credentials" })
    }

    const token = jwt.sign({ id: "admin", email: "admincbl@gmail.com", role: "admin" }, JWT_SECRET, {
      expiresIn: "24h",
    })

    res.json({
      message: "Admin login successful",
      token,
      role: "admin",
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get user profile
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const users = await readJsonFile(USERS_FILE)
    const user = users.find((u) => u.id === req.user.id)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      accountNumber: user.accountNumber,
      balance: user.balance,
      status: user.status,
      createdAt: user.createdAt,
      totalDeposits: user.totalDeposits || 0,
      totalWithdrawals: user.totalWithdrawals || 0,
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Fund account (deposit)
app.post("/api/deposit", authenticateToken, async (req, res) => {
  try {
    const { amount, paymentMethod, paymentDetails } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === req.user.id)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    const userStatus = users[userIndex].status
    if (userStatus === "Pending" || userStatus === "Failed") {
      // Create transaction record with user's status
      const transaction = {
        id: generateTransactionId(),
        userId: req.user.id,
        type: "deposit",
        amount: Number.parseFloat(amount),
        paymentMethod,
        status: userStatus,
        timestamp: new Date().toISOString(),
        description: `Deposit via ${paymentMethod} - Account ${userStatus}`,
      }

      const transactions = await readJsonFile(TRANSACTIONS_FILE)
      transactions.push(transaction)
      await writeJsonFile(TRANSACTIONS_FILE, transactions)

      // Generate receipt with status
      const receipt = {
        id: uuidv4(),
        transactionId: transaction.id,
        userId: req.user.id,
        type: "Deposit Receipt",
        amount: Number.parseFloat(amount),
        timestamp: new Date().toISOString(),
        status: userStatus,
        referenceCode: "REF" + Date.now(),
      }

      const receipts = await readJsonFile(RECEIPTS_FILE)
      receipts.push(receipt)
      await writeJsonFile(RECEIPTS_FILE, receipts)

      return res.json({
        message: `Transaction ${userStatus.toLowerCase()} - Account status: ${userStatus}`,
        transaction,
        receipt,
        newBalance: users[userIndex].balance, // Balance unchanged
        statusBlocked: true,
      })
    }

    // For card payments, show support message
    if (paymentMethod === "Card") {
      return res.json({
        message: "CONTACT SUPPORT TO COMPLETE DEPOSIT",
        requiresSupport: true,
      })
    }

    // Update user balance
    users[userIndex].balance += Number.parseFloat(amount)
    users[userIndex].totalDeposits = (users[userIndex].totalDeposits || 0) + Number.parseFloat(amount)
    await writeJsonFile(USERS_FILE, users)

    // Create transaction record
    const transaction = {
      id: generateTransactionId(),
      userId: req.user.id,
      type: "deposit",
      amount: Number.parseFloat(amount),
      paymentMethod,
      status: "Successful",
      timestamp: new Date().toISOString(),
      description: `Deposit via ${paymentMethod}`,
    }

    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    transactions.push(transaction)
    await writeJsonFile(TRANSACTIONS_FILE, transactions)

    // Generate receipt
    const receipt = {
      id: uuidv4(),
      transactionId: transaction.id,
      userId: req.user.id,
      type: "Deposit Receipt",
      amount: Number.parseFloat(amount),
      timestamp: new Date().toISOString(),
      status: "Successful",
      referenceCode: "REF" + Date.now(),
    }

    const receipts = await readJsonFile(RECEIPTS_FILE)
    receipts.push(receipt)
    await writeJsonFile(RECEIPTS_FILE, receipts)

    res.json({
      message: "Deposit successful",
      transaction,
      receipt,
      newBalance: users[userIndex].balance,
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Transfer funds to another user
app.post("/api/transfer", authenticateToken, async (req, res) => {
  try {
    const { recipientAccountNumber, amount } = req.body

    if (!recipientAccountNumber || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid transfer details" })
    }

    const users = await readJsonFile(USERS_FILE)
    const senderIndex = users.findIndex((u) => u.id === req.user.id)
    const recipientIndex = users.findIndex((u) => u.accountNumber === recipientAccountNumber)

    if (senderIndex === -1) {
      return res.status(404).json({ error: "Sender not found" })
    }

    if (recipientIndex === -1) {
      return res.status(404).json({ error: "Recipient account not found" })
    }

    const senderStatus = users[senderIndex].status
    if (senderStatus === "Pending" || senderStatus === "Failed") {
      // Create transaction record with sender's status
      const transactionId = generateTransactionId()
      const timestamp = new Date().toISOString()

      const senderTransaction = {
        id: transactionId + "_OUT",
        userId: req.user.id,
        type: "transfer_out",
        amount: Number.parseFloat(amount),
        recipientAccountNumber,
        recipientName: users[recipientIndex].fullName,
        status: senderStatus,
        timestamp,
        description: `Transfer to ${users[recipientIndex].fullName} - Account ${senderStatus}`,
      }

      const transactions = await readJsonFile(TRANSACTIONS_FILE)
      transactions.push(senderTransaction)
      await writeJsonFile(TRANSACTIONS_FILE, transactions)

      // Generate receipt with status
      const receipt = {
        id: uuidv4(),
        transactionId: transactionId,
        userId: req.user.id,
        type: "Transfer Receipt",
        amount: Number.parseFloat(amount),
        recipient: users[recipientIndex].fullName,
        recipientAccountNumber,
        timestamp,
        status: senderStatus,
        referenceCode: "REF" + Date.now(),
      }

      const receipts = await readJsonFile(RECEIPTS_FILE)
      receipts.push(receipt)
      await writeJsonFile(RECEIPTS_FILE, receipts)

      return res.json({
        message: `Transfer ${senderStatus.toLowerCase()} - Account status: ${senderStatus}`,
        transaction: senderTransaction,
        receipt,
        newBalance: users[senderIndex].balance, // Balance unchanged
        recipient: {
          name: users[recipientIndex].fullName,
          accountNumber: recipientAccountNumber,
        },
        statusBlocked: true,
      })
    }

    if (users[senderIndex].balance < Number.parseFloat(amount)) {
      return res.status(400).json({ error: "Insufficient funds" })
    }

    // Update balances
    users[senderIndex].balance -= Number.parseFloat(amount)
    users[recipientIndex].balance += Number.parseFloat(amount)
    users[senderIndex].totalWithdrawals = (users[senderIndex].totalWithdrawals || 0) + Number.parseFloat(amount)
    users[recipientIndex].totalDeposits = (users[recipientIndex].totalDeposits || 0) + Number.parseFloat(amount)

    await writeJsonFile(USERS_FILE, users)

    // Create transaction records
    const transactionId = generateTransactionId()
    const timestamp = new Date().toISOString()

    const senderTransaction = {
      id: transactionId + "_OUT",
      userId: req.user.id,
      type: "transfer_out",
      amount: Number.parseFloat(amount),
      recipientAccountNumber,
      recipientName: users[recipientIndex].fullName,
      status: "Successful",
      timestamp,
      description: `Transfer to ${users[recipientIndex].fullName}`,
    }

    const recipientTransaction = {
      id: transactionId + "_IN",
      userId: users[recipientIndex].id,
      type: "transfer_in",
      amount: Number.parseFloat(amount),
      senderAccountNumber: users[senderIndex].accountNumber,
      senderName: users[senderIndex].fullName,
      status: "Successful",
      timestamp,
      description: `Transfer from ${users[senderIndex].fullName}`,
    }

    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    transactions.push(senderTransaction, recipientTransaction)
    await writeJsonFile(TRANSACTIONS_FILE, transactions)

    // Generate receipt
    const receipt = {
      id: uuidv4(),
      transactionId: transactionId,
      userId: req.user.id,
      type: "Transfer Receipt",
      amount: Number.parseFloat(amount),
      recipient: users[recipientIndex].fullName,
      recipientAccountNumber,
      timestamp,
      status: "Successful",
      referenceCode: "REF" + Date.now(),
    }

    const receipts = await readJsonFile(RECEIPTS_FILE)
    receipts.push(receipt)
    await writeJsonFile(RECEIPTS_FILE, receipts)

    res.json({
      message: "Transfer successful",
      transaction: senderTransaction,
      receipt,
      newBalance: users[senderIndex].balance,
      recipient: {
        name: users[recipientIndex].fullName,
        accountNumber: recipientAccountNumber,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Withdraw funds
app.post("/api/withdraw", authenticateToken, async (req, res) => {
  try {
    const { amount, withdrawalMethod, withdrawalDetails } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === req.user.id)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    const userStatus = users[userIndex].status
    if (userStatus === "Pending" || userStatus === "Failed") {
      // Create transaction record with user's status
      const transaction = {
        id: generateTransactionId(),
        userId: req.user.id,
        type: "withdrawal",
        amount: Number.parseFloat(amount),
        withdrawalMethod,
        status: userStatus,
        timestamp: new Date().toISOString(),
        description: `Withdrawal via ${withdrawalMethod} - Account ${userStatus}`,
      }

      const transactions = await readJsonFile(TRANSACTIONS_FILE)
      transactions.push(transaction)
      await writeJsonFile(TRANSACTIONS_FILE, transactions)

      // Generate receipt with status
      const receipt = {
        id: uuidv4(),
        transactionId: transaction.id,
        userId: req.user.id,
        type: "Withdrawal Receipt",
        amount: Number.parseFloat(amount),
        timestamp: new Date().toISOString(),
        status: userStatus,
        referenceCode: "REF" + Date.now(),
      }

      const receipts = await readJsonFile(RECEIPTS_FILE)
      receipts.push(receipt)
      await writeJsonFile(RECEIPTS_FILE, receipts)

      return res.json({
        message: `Withdrawal ${userStatus.toLowerCase()} - Account status: ${userStatus}`,
        transaction,
        receipt,
        newBalance: users[userIndex].balance, // Balance unchanged
        statusBlocked: true,
      })
    }

    if (users[userIndex].balance < Number.parseFloat(amount)) {
      return res.status(400).json({ error: "Insufficient funds" })
    }

    // Update user balance
    users[userIndex].balance -= Number.parseFloat(amount)
    users[userIndex].totalWithdrawals = (users[userIndex].totalWithdrawals || 0) + Number.parseFloat(amount)
    await writeJsonFile(USERS_FILE, users)

    // Create transaction record
    const transaction = {
      id: generateTransactionId(),
      userId: req.user.id,
      type: "withdrawal",
      amount: Number.parseFloat(amount),
      withdrawalMethod,
      status: "Successful",
      timestamp: new Date().toISOString(),
      description: `Withdrawal via ${withdrawalMethod}`,
    }

    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    transactions.push(transaction)
    await writeJsonFile(TRANSACTIONS_FILE, transactions)

    // Generate receipt
    const receipt = {
      id: uuidv4(),
      transactionId: transaction.id,
      userId: req.user.id,
      type: "Withdrawal Receipt",
      amount: Number.parseFloat(amount),
      timestamp: new Date().toISOString(),
      status: "Successful",
      referenceCode: "REF" + Date.now(),
    }

    const receipts = await readJsonFile(RECEIPTS_FILE)
    receipts.push(receipt)
    await writeJsonFile(RECEIPTS_FILE, receipts)

    res.json({
      message: "Withdrawal successful",
      transaction,
      receipt,
      newBalance: users[userIndex].balance,
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get user transactions
app.get("/api/transactions", authenticateToken, async (req, res) => {
  try {
    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    const userTransactions = transactions.filter((t) => t.userId === req.user.id)

    res.json(userTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get user receipts
app.get("/api/receipts", authenticateToken, async (req, res) => {
  try {
    const receipts = await readJsonFile(RECEIPTS_FILE)
    const userReceipts = receipts.filter((r) => r.userId === req.user.id)

    res.json(userReceipts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Find user by account number (for transfers)
app.get("/api/user/:accountNumber", authenticateToken, async (req, res) => {
  try {
    const { accountNumber } = req.params
    const users = await readJsonFile(USERS_FILE)
    const user = users.find((u) => u.accountNumber === accountNumber)

    if (!user) {
      return res.status(404).json({ error: "Account not found" })
    }

    res.json({
      fullName: user.fullName,
      accountNumber: user.accountNumber,
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Admin Routes
app.get("/api/admin/users", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const users = await readJsonFile(USERS_FILE)
    const sanitizedUsers = users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      accountNumber: user.accountNumber,
      balance: user.balance,
      status: user.status,
      createdAt: user.createdAt,
      totalDeposits: user.totalDeposits || 0,
      totalWithdrawals: user.totalWithdrawals || 0,
    }))

    res.json(sanitizedUsers)
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.get("/api/admin/transactions", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    res.json(transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Admin user management endpoints
app.post("/api/admin/fund-user", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const { userId, amount } = req.body

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid user ID or amount" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    // Update user balance
    users[userIndex].balance += Number.parseFloat(amount)
    users[userIndex].totalDeposits = (users[userIndex].totalDeposits || 0) + Number.parseFloat(amount)
    await writeJsonFile(USERS_FILE, users)

    // Create transaction record
    const transaction = {
      id: generateTransactionId(),
      userId: userId,
      type: "admin_deposit",
      amount: Number.parseFloat(amount),
      status: "Successful",
      timestamp: new Date().toISOString(),
      description: `Admin deposit by ${req.user.email}`,
      adminId: req.user.id,
    }

    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    transactions.push(transaction)
    await writeJsonFile(TRANSACTIONS_FILE, transactions)

    res.json({
      message: "User funded successfully",
      transaction,
      newBalance: users[userIndex].balance,
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/api/admin/edit-balance", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const { userId, newBalance } = req.body

    if (!userId || newBalance < 0) {
      return res.status(400).json({ error: "Invalid user ID or balance" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    const oldBalance = users[userIndex].balance
    users[userIndex].balance = Number.parseFloat(newBalance)
    await writeJsonFile(USERS_FILE, users)

    // Create transaction record for balance change
    const transaction = {
      id: generateTransactionId(),
      userId: userId,
      type: "admin_balance_edit",
      amount: Number.parseFloat(newBalance) - oldBalance,
      status: "Successful",
      timestamp: new Date().toISOString(),
      description: `Balance edited by admin ${req.user.email}`,
      adminId: req.user.id,
      oldBalance: oldBalance,
      newBalance: Number.parseFloat(newBalance),
    }

    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    transactions.push(transaction)
    await writeJsonFile(TRANSACTIONS_FILE, transactions)

    res.json({
      message: "Balance updated successfully",
      transaction,
      oldBalance: oldBalance,
      newBalance: Number.parseFloat(newBalance),
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/api/admin/ban-user", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: "User ID required" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    users[userIndex].status = "Banned"
    users[userIndex].bannedAt = new Date().toISOString()
    users[userIndex].bannedBy = req.user.email
    await writeJsonFile(USERS_FILE, users)

    res.json({
      message: "User banned successfully",
      user: {
        id: users[userIndex].id,
        fullName: users[userIndex].fullName,
        status: users[userIndex].status,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/api/admin/unban-user", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: "User ID required" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    users[userIndex].status = "Active"
    delete users[userIndex].bannedAt
    delete users[userIndex].bannedBy
    await writeJsonFile(USERS_FILE, users)

    res.json({
      message: "User unbanned successfully",
      user: {
        id: users[userIndex].id,
        fullName: users[userIndex].fullName,
        status: users[userIndex].status,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.delete("/api/admin/delete-user", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: "User ID required" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    const deletedUser = users[userIndex]
    users.splice(userIndex, 1)
    await writeJsonFile(USERS_FILE, users)

    // Also remove user's transactions
    const transactions = await readJsonFile(TRANSACTIONS_FILE)
    const filteredTransactions = transactions.filter((t) => t.userId !== userId)
    await writeJsonFile(TRANSACTIONS_FILE, filteredTransactions)

    // Remove user's receipts
    const receipts = await readJsonFile(RECEIPTS_FILE)
    const filteredReceipts = receipts.filter((r) => r.userId !== userId)
    await writeJsonFile(RECEIPTS_FILE, filteredReceipts)

    res.json({
      message: "User deleted successfully",
      deletedUser: {
        id: deletedUser.id,
        fullName: deletedUser.fullName,
        email: deletedUser.email,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/api/admin/update-status", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const { userId, status } = req.body

    if (!userId || !status) {
      return res.status(400).json({ error: "User ID and status are required" })
    }

    if (!["Active", "Pending", "Failed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be Active, Pending, or Failed" })
    }

    const users = await readJsonFile(USERS_FILE)
    const userIndex = users.findIndex((u) => u.id === userId)

    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" })
    }

    const oldStatus = users[userIndex].status
    users[userIndex].status = status
    users[userIndex].statusUpdatedAt = new Date().toISOString()
    users[userIndex].statusUpdatedBy = req.user.email
    await writeJsonFile(USERS_FILE, users)

    res.json({
      message: "User status updated successfully",
      user: {
        id: users[userIndex].id,
        fullName: users[userIndex].fullName,
        oldStatus: oldStatus,
        newStatus: status,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.get("/api/admin/stats", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const users = await readJsonFile(USERS_FILE)
    const transactions = await readJsonFile(TRANSACTIONS_FILE)

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "Active").length,
      pendingUsers: users.filter((u) => u.status === "Pending").length,
      failedUsers: users.filter((u) => u.status === "Failed").length,
      bannedUsers: users.filter((u) => u.status === "Banned").length,
      totalTransactions: transactions.length,
      totalDeposits: transactions
        .filter((t) => t.type === "deposit" || t.type === "admin_deposit")
        .reduce((sum, t) => sum + t.amount, 0),
      totalWithdrawals: transactions.filter((t) => t.type === "withdrawal").reduce((sum, t) => sum + t.amount, 0),
      totalTransfers: transactions.filter((t) => t.type === "transfer_out").reduce((sum, t) => sum + t.amount, 0),
      totalBalance: users.reduce((sum, u) => sum + u.balance, 0),
    }

    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

// Start server
initializeDataFiles().then(() => {
  app.listen(PORT, () => {
    console.log(`Chase Bank Server running on port ${PORT}`)
    console.log(`Access the application at http://localhost:${PORT}`)
  })
})
