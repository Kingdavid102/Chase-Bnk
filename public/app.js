// Global variables
let currentUser = null
let authToken = null
let balanceVisible = true

// API Base URL
const API_BASE = ""

// Utility functions
function showError(message) {
  const errorDiv = document.createElement("div")
  errorDiv.className = "error-message"
  errorDiv.textContent = message

  const existingError = document.querySelector(".error-message")
  if (existingError) {
    existingError.remove()
  }

  const form = document.querySelector("form") || document.querySelector(".form-container")
  if (form) {
    form.insertBefore(errorDiv, form.firstChild)
  }
}

function showSuccess(message) {
  const successDiv = document.createElement("div")
  successDiv.className = "success-message"
  successDiv.textContent = message

  const existingSuccess = document.querySelector(".success-message")
  if (existingSuccess) {
    existingSuccess.remove()
  }

  const form = document.querySelector("form") || document.querySelector(".form-container")
  if (form) {
    form.insertBefore(successDiv, form.firstChild)
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function getInitials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

// Authentication functions
function saveAuth(user, token) {
  localStorage.setItem("chaseUser", JSON.stringify(user))
  localStorage.setItem("chaseToken", token)
  currentUser = user
  authToken = token
}

function loadAuth() {
  const user = localStorage.getItem("chaseUser")
  const token = localStorage.getItem("chaseToken")

  if (user && token) {
    currentUser = JSON.parse(user)
    authToken = token
    return true
  }
  return false
}

function clearAuth() {
  localStorage.removeItem("chaseUser")
  localStorage.removeItem("chaseToken")
  currentUser = null
  authToken = null
}

function checkAuth() {
  if (loadAuth()) {
    window.location.href = "dashboard.html"
  } else {
    window.location.href = "login.html"
  }
}

function requireAuth() {
  if (!loadAuth()) {
    window.location.href = "login.html"
    return false
  }
  return true
}

// API functions
async function apiCall(endpoint, options = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  }

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`
  }

  try {
    const response = await fetch(API_BASE + endpoint, config)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "An error occurred")
    }

    return data
  } catch (error) {
    console.error("API Error:", error)
    throw error
  }
}

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  // Check if we're on a page that requires auth
  const protectedPages = [
    "dashboard.html",
    "deposit.html",
    "withdraw.html",
    "transfer.html",
    "transactions.html",
    "profile.html",
  ]
  const currentPage = window.location.pathname.split("/").pop()

  if (protectedPages.includes(currentPage)) {
    if (!requireAuth()) {
      return
    }
  }

  // Initialize page-specific functionality
  initializePage()
})

function initializePage() {
  const currentPage = window.location.pathname.split("/").pop()

  switch (currentPage) {
    case "register.html":
      initializeRegister()
      break
    case "login.html":
      initializeLogin()
      break
    case "dashboard.html":
      initializeDashboard()
      break
    case "admin.html":
      initializeAdmin()
      break
    default:
      // Home page or other pages
      break
  }
}

// Page initialization functions
function initializeRegister() {
  const form = document.getElementById("registerForm")
  if (form) {
    form.addEventListener("submit", handleRegister)
  }
}

function initializeLogin() {
  const form = document.getElementById("loginForm")
  if (form) {
    form.addEventListener("submit", handleLogin)
  }
}

function initializeDashboard() {
  loadDashboard()
  setupMobileMenu()
  setupBalanceToggle()
}

function initializeAdmin() {
  const keyForm = document.getElementById("adminKeyForm")
  const loginForm = document.getElementById("adminLoginForm")

  if (keyForm) {
    keyForm.addEventListener("submit", handleAdminKey)
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleAdminLogin)
  }
}

// Event handlers
async function handleRegister(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const data = {
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    email: formData.get("email"),
    password: formData.get("password"),
  }

  const confirmPassword = formData.get("confirmPassword")

  if (data.password !== confirmPassword) {
    showError("Passwords do not match")
    return
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.innerHTML = '<span class="loading"></span> Creating Account...'

    const response = await apiCall("/api/register", {
      method: "POST",
      body: JSON.stringify(data),
    })

    saveAuth(response.user, response.token)
    showSuccess("Account created successfully! Redirecting...")

    setTimeout(() => {
      window.location.href = "dashboard.html"
    }, 2000)
  } catch (error) {
    showError(error.message)
    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = "Create Account"
  }
}

async function handleLogin(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const data = {
    emailOrUsername: formData.get("emailOrUsername"),
    password: formData.get("password"),
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.innerHTML = '<span class="loading"></span> Signing In...'

    const response = await apiCall("/api/login", {
      method: "POST",
      body: JSON.stringify(data),
    })

    saveAuth(response.user, response.token)
    showSuccess("Login successful! Redirecting...")

    setTimeout(() => {
      window.location.href = "dashboard.html"
    }, 1500)
  } catch (error) {
    showError(error.message)
    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = "Sign In"
  }
}

async function loadDashboard() {
  try {
    const profile = await apiCall("/api/profile")
    currentUser = profile

    // Update UI with user data
    document.getElementById("userName").textContent = profile.fullName
    document.getElementById("userInitials").textContent = getInitials(profile.fullName)
    document.getElementById("currentDate").textContent = formatDate(new Date())
    document.getElementById("accountNumber").textContent = profile.accountNumber
    document.getElementById("currentBalance").textContent = formatCurrency(profile.balance)
    document.getElementById("totalDeposits").textContent = formatCurrency(profile.totalDeposits)
    document.getElementById("totalWithdrawals").textContent = formatCurrency(profile.totalWithdrawals)

    updateAccountStatus(profile.status)

    updateProfilePicture(profile)

    if (profile.status !== "Active") {
      showStatusModal(profile.status)
    }

    // Load recent transactions
    loadRecentTransactions()
  } catch (error) {
    console.error("Error loading dashboard:", error)
    showError("Error loading dashboard data")
  }
}

async function loadRecentTransactions() {
  try {
    const transactions = await apiCall("/api/transactions")
    const recentTransactions = transactions.slice(0, 5)

    const transactionsList = document.getElementById("recentTransactions")
    if (transactionsList) {
      transactionsList.innerHTML = recentTransactions
        .map(
          (transaction) => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-type">${transaction.description}</div>
                        <div class="transaction-date">${formatDate(transaction.timestamp)}</div>
                    </div>
                    <div class="transaction-amount ${transaction.type === "deposit" || transaction.type === "transfer_in" ? "positive" : "negative"}">
                        ${transaction.type === "deposit" || transaction.type === "transfer_in" ? "+" : "-"}${formatCurrency(Math.abs(transaction.amount))}
                    </div>
                </div>
            `,
        )
        .join("")
    }
  } catch (error) {
    console.error("Error loading transactions:", error)
  }
}

function setupMobileMenu() {
  const menuBtn = document.getElementById("mobileMenuBtn")
  const menu = document.getElementById("mobileMenu")
  const closeBtn = document.getElementById("mobileMenuClose")

  if (menuBtn && menu && closeBtn) {
    menuBtn.addEventListener("click", () => {
      menu.classList.add("active")
      document.body.style.overflow = "hidden"
    })

    closeBtn.addEventListener("click", () => {
      menu.classList.remove("active")
      document.body.style.overflow = "auto"
    })

    menu.addEventListener("click", (e) => {
      if (e.target === menu) {
        menu.classList.remove("active")
        document.body.style.overflow = "auto"
      }
    })

    const menuLinks = menu.querySelectorAll(".mobile-menu-link")
    menuLinks.forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("active")
        document.body.style.overflow = "auto"
      })
    })
  }
}

function logout() {
  clearAuth()
  window.location.href = "index.html"
}

// Admin functions
function handleAdminKey(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const adminKey = formData.get("adminKey")

  if (adminKey === "kfhiwngaobegsnsvshsbsjdhhd") {
    document.getElementById("adminKeySection").style.display = "none"
    document.getElementById("adminLoginSection").style.display = "block"
  } else {
    showError("Invalid admin key")
  }
}

async function handleAdminLogin(e) {
  e.preventDefault()

  const formData = new FormData(e.target)
  const data = {
    adminKey: "kfhiwngaobegsnsvshsbsjdhhd",
    email: formData.get("email"),
    password: formData.get("password"),
  }

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.innerHTML = '<span class="loading"></span> Signing In...'

    const response = await apiCall("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(data),
    })

    localStorage.setItem("adminToken", response.token)
    authToken = response.token

    showSuccess("Admin login successful! Redirecting...")

    setTimeout(() => {
      window.location.href = "admin-dashboard.html"
    }, 1500)
  } catch (error) {
    showError(error.message)
    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = "Sign In as Admin"
  }
}

// Modal functions
function showModal(title, message, buttons = []) {
  const modal = document.getElementById("modal") || createModal()
  const modalTitle = modal.querySelector(".modal-title")
  const modalMessage = modal.querySelector(".modal-message")
  const modalButtons = modal.querySelector(".modal-buttons")

  modalTitle.textContent = title
  modalMessage.textContent = message

  modalButtons.innerHTML = ""
  buttons.forEach((button) => {
    const btn = document.createElement("button")
    btn.className = `modal-btn ${button.class || "modal-btn-primary"}`
    btn.textContent = button.text
    btn.onclick = button.onclick
    modalButtons.appendChild(btn)
  })

  modal.classList.add("active")
}

function hideModal() {
  const modal = document.getElementById("modal")
  if (modal) {
    modal.classList.remove("active")
  }
}

function createModal() {
  const modal = document.createElement("div")
  modal.id = "modal"
  modal.className = "modal"
  modal.innerHTML = `
        <div class="modal-content">
            <h3 class="modal-title"></h3>
            <p class="modal-message"></p>
            <div class="modal-buttons"></div>
        </div>
    `
  document.body.appendChild(modal)

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      hideModal()
    }
  })

  return modal
}

// Added functions for dashboard updates
function updateAccountStatus(status) {
  const statusIndicator = document.getElementById("statusIndicator")
  const statusText = document.getElementById("statusText")

  if (statusIndicator && statusText) {
    statusText.textContent = `Account ${status}`

    // Remove existing status classes
    statusIndicator.className = "status-indicator"

    // Add appropriate status class
    switch (status) {
      case "Active":
        statusIndicator.classList.add("active")
        break
      case "Pending":
        statusIndicator.classList.add("pending")
        break
      case "Failed":
        statusIndicator.classList.add("failed")
        break
      case "Banned":
        statusIndicator.classList.add("banned")
        break
      default:
        statusIndicator.classList.add("active")
    }
  }
}

function showStatusModal(status) {
  const modal = document.getElementById("statusModal")
  const icon = document.getElementById("statusModalIcon")
  const title = document.getElementById("statusModalTitle")
  const message = document.getElementById("statusModalMessage")

  if (modal && icon && title && message) {
    let iconText = "⚠️"
    let titleText = "Account Status Alert"
    let messageText = "Your account status affects transaction processing."

    switch (status) {
      case "Pending":
        iconText = "⏳"
        titleText = "Account Pending"
        messageText =
          "Your account is currently under review. Transactions will show as pending until your account is activated."
        break
      case "Failed":
        iconText = "❌"
        titleText = "Account Failed"
        messageText =
          "There is an issue with your account. Transactions will fail until resolved. Please contact support."
        break
      case "Banned":
        iconText = "🚫"
        titleText = "Account Suspended"
        messageText = "Your account has been suspended. Please contact support for assistance."
        break
    }

    icon.textContent = iconText
    title.textContent = titleText
    message.textContent = messageText
    modal.style.display = "flex"
  }
}

function closeStatusModal() {
  const modal = document.getElementById("statusModal")
  if (modal) {
    modal.style.display = "none"
  }
}

function updateProfilePicture(profile) {
  const profileCircle = document.getElementById("userProfileCircle")
  const profileImage = document.getElementById("profileImage")
  const userInitials = document.getElementById("userInitials")

  if (profile.profilePicture && profileImage && userInitials) {
    profileImage.src = profile.profilePicture
    profileImage.style.display = "block"
    userInitials.style.display = "none"
  } else if (userInitials) {
    userInitials.textContent = getInitials(profile.fullName)
    userInitials.style.display = "flex"
    if (profileImage) {
      profileImage.style.display = "none"
    }
  }
}

function setupBalanceToggle() {
  const toggleBtn = document.getElementById("balanceToggle");
  if (toggleBtn) {
    // Load saved preference
    const savedVisibility = localStorage.getItem("balanceVisible");
    if (savedVisibility !== null) {
      balanceVisible = savedVisibility === "true";
    } else {
      // Default to visible if no preference is saved
      balanceVisible = true;
      localStorage.setItem("balanceVisible", "true");
    }
    
    // Initialize the visibility
    updateBalanceVisibility();
    
    // Add click event listener
    toggleBtn.addEventListener("click", toggleBalanceVisibility);
  }
}

function toggleBalanceVisibility() {
  balanceVisible = !balanceVisible;
  localStorage.setItem("balanceVisible", balanceVisible.toString());
  updateBalanceVisibility();
}

function updateBalanceVisibility() {
  const balanceAmount = document.getElementById("currentBalance");
  const toggleIcon = document.getElementById("balanceToggleIcon");
  
  if (balanceAmount && toggleIcon) {
    if (balanceVisible) {
      balanceAmount.style.filter = "none";
      toggleIcon.className = "fas fa-eye";
      toggleIcon.style.color = ""; // Reset to default color
    } else {
      balanceAmount.style.filter = "blur(8px)";
      toggleIcon.className = "fas fa-eye-slash";
      toggleIcon.style.color = "#4285f4"; // Blue color when hidden
    }
  }
}

// Add this function to update account details
function updateAccountDetails(profile) {
  // Update account number
  const accountNumberDisplay = document.getElementById("accountNumberDisplay");
  if (accountNumberDisplay && profile.accountNumber) {
    accountNumberDisplay.textContent = profile.accountNumber;
  }
  
  // Update account status
  const accountStatusDisplay = document.getElementById("accountStatusDisplay");
  if (accountStatusDisplay) {
    accountStatusDisplay.textContent = profile.status;
    accountStatusDisplay.className = "detail-value";
    
    // Add appropriate status class
    switch(profile.status) {
      case "Active":
        accountStatusDisplay.classList.add("status-active");
        break;
      case "Pending":
        accountStatusDisplay.classList.add("status-pending");
        break;
      case "Failed":
      case "Banned":
        accountStatusDisplay.classList.add("status-inactive");
        break;
    }
  }
  
  // Update member since date
  const memberSinceDisplay = document.getElementById("memberSinceDisplay");
  if (memberSinceDisplay && profile.createdAt) {
    const joinDate = new Date(profile.createdAt);
    memberSinceDisplay.textContent = joinDate.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  }
}

// Add this function to load monthly summary
async function loadMonthlySummary() {
  try {
    // This would typically come from your API
    const monthlyData = await apiCall("/api/transactions/monthly");
    
    // Update monthly deposits
    const monthlyDeposits = document.getElementById("monthlyDeposits");
    if (monthlyDeposits) {
      monthlyDeposits.textContent = formatCurrency(monthlyData.deposits || 0);
    }
    
    // Update monthly withdrawals
    const monthlyWithdrawals = document.getElementById("monthlyWithdrawals");
    if (monthlyWithdrawals) {
      monthlyWithdrawals.textContent = formatCurrency(monthlyData.withdrawals || 0);
    }
    
    // Update monthly transfers
    const monthlyTransfers = document.getElementById("monthlyTransfers");
    if (monthlyTransfers) {
      monthlyTransfers.textContent = formatCurrency(monthlyData.transfers || 0);
    }
  } catch (error) {
    console.error("Error loading monthly summary:", error);
    // Set default values if API call fails
    document.getElementById("monthlyDeposits").textContent = formatCurrency(0);
    document.getElementById("monthlyWithdrawals").textContent = formatCurrency(0);
    document.getElementById("monthlyTransfers").textContent = formatCurrency(0);
  }
}

// Update your loadDashboard function to call these new functions
async function loadDashboard() {
  try {
    const profile = await apiCall("/api/profile");
    currentUser = profile;

    // Update UI with user data
    document.getElementById("userName").textContent = profile.fullName;
    document.getElementById("userInitials").textContent = getInitials(profile.fullName);
    document.getElementById("currentDate").textContent = formatDate(new Date());
    document.getElementById("accountNumber").textContent = profile.accountNumber;
    document.getElementById("currentBalance").textContent = formatCurrency(profile.balance);
    document.getElementById("totalDeposits").textContent = formatCurrency(profile.totalDeposits);
    document.getElementById("totalWithdrawals").textContent = formatCurrency(profile.totalWithdrawals);

    updateAccountStatus(profile.status);
    updateAccountDetails(profile); // Add this line
    updateProfilePicture(profile);

    if (profile.status !== "Active") {
      showStatusModal(profile.status);
    }

    // Load recent transactions and monthly summary
    loadRecentTransactions();
    loadMonthlySummary(); // Add this line
  } catch (error) {
    console.error("Error loading dashboard:", error);
    showError("Error loading dashboard data");
  }
}
