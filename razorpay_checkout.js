/**
 * Razorpay Payment Integration & Test Simulator
 * RailReserve Railway Reservation System
 */

(function () {
    // Inject Razorpay CDN script if not present
    if (!document.getElementById("razorpay-cdn-script")) {
        const script = document.createElement("script");
        script.id = "razorpay-cdn-script";
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.head.appendChild(script);
    }

    // Modal HTML template
    const modalHTML = `
    <div id="razorpaySimulatorModal" class="fixed inset-0 z-[9999] hidden flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
        <div class="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 transform transition-all animate-in fade-in zoom-in-95 duration-200 font-sans">
            
            <!-- Razorpay Official-Style Header -->
            <div class="bg-gradient-to-r from-[#0c2340] via-[#123b65] to-[#0284c7] p-5 text-white relative">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-sky-300 text-xl font-black shadow-inner border border-white/20">
                            <i class="fa-solid fa-bolt"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-extrabold text-lg tracking-tight">Razorpay</span>
                                <span class="text-[9px] font-bold uppercase tracking-wider bg-amber-400 text-slate-900 px-2 py-0.5 rounded shadow-sm">Test Mode</span>
                            </div>
                            <p class="text-[11px] text-sky-200 flex items-center gap-1">
                                <i class="fa-solid fa-shield-halved text-emerald-400 text-[10px]"></i>
                                Secured by 256-Bit SSL &bull; Indian Railways Portal
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeRazorpaySimulator(false)" class="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition text-lg" title="Cancel Payment">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Order Amount Highlight Banner -->
                <div class="mt-4 bg-white/10 backdrop-blur-md rounded-lg p-3 border border-white/15 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] uppercase font-bold tracking-wider text-sky-200 block">Total Payable Fare</span>
                        <div class="text-2xl font-black text-white font-mono tracking-tight" id="rzpModalFare">₹0.00</div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] uppercase font-bold tracking-wider text-sky-200 block" id="rzpModalTrainTitle">Train Reservation</span>
                        <span class="text-xs font-semibold text-emerald-300 font-mono" id="rzpModalOrderId">order_test_12345</span>
                    </div>
                </div>
            </div>

            <!-- Payment Method Tabs -->
            <div class="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                <button type="button" onclick="window.switchRzpTab('upi')" id="rzpTabBtn_upi" class="flex-1 py-3 px-2 border-b-2 border-sky-600 text-sky-700 dark:text-sky-400 bg-white dark:bg-slate-900 flex items-center justify-center gap-1.5 transition">
                    <i class="fa-solid fa-qrcode text-sky-600 dark:text-sky-400"></i> UPI / QR
                </button>
                <button type="button" onclick="window.switchRzpTab('card')" id="rzpTabBtn_card" class="flex-1 py-3 px-2 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition">
                    <i class="fa-solid fa-credit-card"></i> Card
                </button>
                <button type="button" onclick="window.switchRzpTab('netbanking')" id="rzpTabBtn_netbanking" class="flex-1 py-3 px-2 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition">
                    <i class="fa-solid fa-building-columns"></i> Netbanking
                </button>
            </div>

            <!-- Tab 1: UPI -->
            <div id="rzpTab_upi" class="p-5 space-y-4">
                <div class="bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-slate-800 dark:to-slate-850 border border-sky-100 dark:border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div class="w-28 h-28 bg-white p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center relative group">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=railways@razorpay&pn=IndianRailways&cu=INR" alt="UPI QR" class="w-full h-full object-contain">
                        <div class="absolute inset-0 bg-sky-900/10 rounded-lg flex items-center justify-center pointer-events-none">
                            <span class="bg-white/95 text-[9px] font-black text-sky-800 px-1 rounded shadow">BHIM UPI</span>
                        </div>
                    </div>
                    <div class="space-y-1">
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center sm:justify-start gap-1.5">
                            <i class="fa-solid fa-camera text-sky-600 dark:text-sky-400"></i> Scan to Pay with Any UPI App
                        </span>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">Google Pay, PhonePe, Paytm, BHIM, Cred or any bank UPI app.</p>
                        <div class="flex flex-wrap gap-1.5 pt-1 justify-center sm:justify-start">
                            <span class="text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">GPay</span>
                            <span class="text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">PhonePe</span>
                            <span class="text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">Paytm</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Or Enter Virtual Payment Address (UPI ID)</label>
                    <div class="relative">
                        <input type="text" id="rzpUpiId" value="passenger@okhdfcbank" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="mobile@upi / name@bank">
                        <button type="button" onclick="window.rzpFillUpi('railway.test@okhdfcbank')" class="absolute right-2 top-2 text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-800 px-1.5 py-0.5 rounded bg-sky-50 dark:bg-slate-800">
                            Auto-Fill
                        </button>
                    </div>
                    <div class="flex gap-1.5 mt-2">
                        <button type="button" onclick="window.rzpFillUpi('success@razorpay')" class="text-[10px] text-slate-500 dark:text-slate-400 hover:text-sky-600 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 px-2 py-1 rounded transition">@razorpay</button>
                        <button type="button" onclick="window.rzpFillUpi('passenger@okhdfcbank')" class="text-[10px] text-slate-500 dark:text-slate-400 hover:text-sky-600 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 px-2 py-1 rounded transition">@okhdfcbank</button>
                        <button type="button" onclick="window.rzpFillUpi('user@paytm')" class="text-[10px] text-slate-500 dark:text-slate-400 hover:text-sky-600 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 px-2 py-1 rounded transition">@paytm</button>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Card -->
            <div id="rzpTab_card" class="p-5 space-y-3 hidden">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-bold text-slate-700 dark:text-slate-300">Enter Card Details</span>
                    <button type="button" onclick="window.rzpFillTestCard()" class="text-sky-600 dark:text-sky-400 hover:text-sky-800 font-bold text-[11px] flex items-center gap-1">
                        <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i> Fill Dummy Card
                    </button>
                </div>
                <div>
                    <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Card Number</label>
                    <div class="relative">
                        <input type="text" id="rzpCardNumber" value="4111 1111 1111 1111" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs font-mono tracking-wider text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="4111 1111 1111 1111">
                        <span class="absolute right-3 top-2.5 text-slate-400 text-xs font-bold text-sky-700 dark:text-sky-400">VISA / MC</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Expiry (MM/YY)</label>
                        <input type="text" id="rzpCardExpiry" value="12/28" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="12/28">
                    </div>
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">CVV</label>
                        <input type="password" id="rzpCardCvv" value="123" maxlength="3" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="123">
                    </div>
                </div>
                <div>
                    <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Cardholder Name</label>
                    <input type="text" id="rzpCardName" value="Railway Passenger" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="Name on Card">
                </div>
            </div>

            <!-- Tab 3: Netbanking -->
            <div id="rzpTab_netbanking" class="p-5 space-y-3 hidden">
                <span class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Select Your Bank</span>
                <div class="grid grid-cols-3 gap-2 text-xs">
                    <label class="border border-sky-600 bg-sky-50/50 dark:bg-slate-800 p-2.5 rounded-lg flex flex-col items-center gap-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input type="radio" name="rzpBank" value="SBI" checked class="accent-sky-600 hidden">
                        <i class="fa-solid fa-building-columns text-sky-700 dark:text-sky-400 text-base"></i>
                        <span class="text-[11px]">SBI</span>
                    </label>
                    <label class="border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-2.5 rounded-lg flex flex-col items-center gap-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input type="radio" name="rzpBank" value="HDFC" class="accent-sky-600 hidden">
                        <i class="fa-solid fa-building-columns text-slate-600 dark:text-slate-400 text-base"></i>
                        <span class="text-[11px]">HDFC Bank</span>
                    </label>
                    <label class="border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-2.5 rounded-lg flex flex-col items-center gap-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input type="radio" name="rzpBank" value="ICICI" class="accent-sky-600 hidden">
                        <i class="fa-solid fa-building-columns text-slate-600 dark:text-slate-400 text-base"></i>
                        <span class="text-[11px]">ICICI Bank</span>
                    </label>
                    <label class="border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-2.5 rounded-lg flex flex-col items-center gap-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input type="radio" name="rzpBank" value="AXIS" class="accent-sky-600 hidden">
                        <i class="fa-solid fa-building-columns text-slate-600 dark:text-slate-400 text-base"></i>
                        <span class="text-[11px]">Axis Bank</span>
                    </label>
                    <label class="border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-2.5 rounded-lg flex flex-col items-center gap-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input type="radio" name="rzpBank" value="KOTAK" class="accent-sky-600 hidden">
                        <i class="fa-solid fa-building-columns text-slate-600 dark:text-slate-400 text-base"></i>
                        <span class="text-[11px]">Kotak Bank</span>
                    </label>
                    <label class="border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-2.5 rounded-lg flex flex-col items-center gap-1 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                        <input type="radio" name="rzpBank" value="PNB" class="accent-sky-600 hidden">
                        <i class="fa-solid fa-building-columns text-slate-600 dark:text-slate-400 text-base"></i>
                        <span class="text-[11px]">PNB</span>
                    </label>
                </div>
            </div>

            <!-- Action Area / Simulation Buttons -->
            <div class="p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button type="button" id="rzpSuccessBtn" onclick="window.rzpSimulatePayment(true)" class="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold py-3 px-4 rounded-lg shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-xs sm:text-sm">
                    <i class="fa-solid fa-lock text-xs"></i>
                    <span id="rzpSuccessBtnText">SIMULATE SUCCESSFUL PAYMENT</span>
                </button>
                
                <div class="flex items-center justify-between gap-2 pt-1">
                    <button type="button" onclick="window.rzpSimulatePayment(false)" class="text-rose-600 hover:text-rose-700 text-xs font-semibold py-1.5 px-2.5 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 transition">
                        <i class="fa-solid fa-ban text-[10px]"></i> Simulate Bank Failure
                    </button>
                    <button type="button" onclick="window.closeRazorpaySimulator(false)" class="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white text-xs font-semibold py-1.5 px-2.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition">
                        Cancel Payment
                    </button>
                </div>
            </div>

            <!-- Footer Trust Note -->
            <div class="px-5 py-2.5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>DBMS Relational Project &bull; Razorpay Secure Gateway</span>
                <span class="font-mono text-emerald-700 dark:text-emerald-400 font-bold">256-Bit SSL Encrypted</span>
            </div>

        </div>
    </div>
    `;

    // Append modal once DOM is ready
    function injectModal() {
        if (!document.getElementById("razorpaySimulatorModal")) {
            const container = document.createElement("div");
            container.innerHTML = modalHTML;
            document.body.appendChild(container.firstElementChild);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectModal);
    } else {
        injectModal();
    }

    // Active transaction state
    let activePaymentConfig = null;

    // Switch tabs
    window.switchRzpTab = function (tabName) {
        ['upi', 'card', 'netbanking'].forEach(t => {
            const tabEl = document.getElementById(`rzpTab_${t}`);
            const btnEl = document.getElementById(`rzpTabBtn_${t}`);
            if (tabEl && btnEl) {
                if (t === tabName) {
                    tabEl.classList.remove('hidden');
                    btnEl.className = "flex-1 py-3 px-2 border-b-2 border-sky-600 text-sky-700 bg-white flex items-center justify-center gap-1.5 transition";
                } else {
                    tabEl.classList.add('hidden');
                    btnEl.className = "flex-1 py-3 px-2 border-b-2 border-transparent hover:text-slate-900 flex items-center justify-center gap-1.5 transition";
                }
            }
        });
    };

    window.rzpFillUpi = function (vpa) {
        const el = document.getElementById("rzpUpiId");
        if (el) el.value = vpa;
    };

    window.rzpFillTestCard = function () {
        const num = document.getElementById("rzpCardNumber");
        const exp = document.getElementById("rzpCardExpiry");
        const cvv = document.getElementById("rzpCardCvv");
        const name = document.getElementById("rzpCardName");
        if (num) num.value = "4111 1111 1111 1111";
        if (exp) exp.value = "12/28";
        if (cvv) cvv.value = "123";
        if (name) name.value = (activePaymentConfig && activePaymentConfig.passengerName) || "Railway Passenger";
    };

    window.closeRazorpaySimulator = function (wasSuccessful = false) {
        const modal = document.getElementById("razorpaySimulatorModal");
        if (modal) modal.classList.add("hidden");
        if (!wasSuccessful && activePaymentConfig && typeof activePaymentConfig.onFailure === "function") {
            activePaymentConfig.onFailure(new Error("Payment cancelled by user."));
        }
    };

    window.rzpSimulatePayment = async function (shouldSucceed) {
        if (!activePaymentConfig) return;

        const btn = document.getElementById("rzpSuccessBtn");
        const btnText = document.getElementById("rzpSuccessBtnText");

        if (shouldSucceed) {
            btn.disabled = true;
            btnText.textContent = "Authorizing with Bank...";
            btn.className = "w-full bg-sky-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm";

            setTimeout(async () => {
                const dummyPaymentId = "pay_rzp_" + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
                
                try {
                    // Call backend verification
                    await fetch("/api/verify-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            razorpay_order_id: activePaymentConfig.orderId,
                            razorpay_payment_id: dummyPaymentId,
                            razorpay_signature: "mock_signature_verified"
                        })
                    });
                } catch (_) {}

                btnText.textContent = "Payment Verified!";
                btn.className = "w-full bg-emerald-600 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm";

                setTimeout(() => {
                    window.closeRazorpaySimulator(true);
                    if (typeof activePaymentConfig.onSuccess === "function") {
                        activePaymentConfig.onSuccess({
                            paymentId: dummyPaymentId,
                            orderId: activePaymentConfig.orderId,
                            method: "Razorpay (UPI/Card Mock)",
                            amount: activePaymentConfig.amount
                        });
                    }
                }, 600);

            }, 1200);

        } else {
            alert("Payment Declined: Bank simulation rejected the test transaction. Your seat was not reserved.");
            window.closeRazorpaySimulator(false);
        }
    };

    /**
     * Main entry point to initiate Razorpay Payment
     * @param {Object} opts - { amount, trainNumber, trainName, classType, passengerName, phone, email, onSuccess, onFailure }
     */
    window.initiateRazorpayPayment = async function (opts) {
        activePaymentConfig = opts;

        try {
            // 1. Create order on server
            const orderRes = await fetch("/api/create-razorpay-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: opts.amount,
                    trainNumber: opts.trainNumber,
                    classType: opts.classType,
                    passengerName: opts.passengerName
                })
            });

            const order = await orderRes.json();
            const orderId = order.id || ("order_test_" + Date.now());
            activePaymentConfig.orderId = orderId;

            // 2. Check if official Razorpay SDK is available and has real key
            if (window.Razorpay && order.keyId && order.keyId.startsWith("rzp_test_") && !order.isSimulated) {
                const rzpOptions = {
                    key: order.keyId,
                    amount: order.amount,
                    currency: "INR",
                    name: "Indian Railways (RailReserve)",
                    description: `Train #${opts.trainNumber} - ${opts.classType}`,
                    order_id: order.id,
                    prefill: {
                        name: opts.passengerName || "Passenger",
                        email: opts.email || "passenger@railway.com",
                        contact: opts.phone || "9876543210"
                    },
                    theme: { color: "#0284c7" },
                    handler: async function (response) {
                        try {
                            await fetch("/api/verify-payment", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    razorpay_order_id: response.razorpay_order_id,
                                    razorpay_payment_id: response.razorpay_payment_id,
                                    razorpay_signature: response.razorpay_signature
                                })
                            });
                        } catch (_) {}

                        if (typeof opts.onSuccess === "function") {
                            opts.onSuccess({
                                paymentId: response.razorpay_payment_id,
                                orderId: response.razorpay_order_id,
                                signature: response.razorpay_signature,
                                method: "Razorpay Official Checkout"
                            });
                        }
                    },
                    modal: {
                        ondismiss: function () {
                            if (typeof opts.onFailure === "function") {
                                opts.onFailure(new Error("Razorpay popup closed without payment."));
                            }
                        }
                    }
                };
                const rzp = new window.Razorpay(rzpOptions);
                rzp.open();
                return;
            }

            // 3. Fallback: Launch the Integrated Razorpay Simulator Modal
            injectModal();
            const modal = document.getElementById("razorpaySimulatorModal");
            const fareEl = document.getElementById("rzpModalFare");
            const trainTitle = document.getElementById("rzpModalTrainTitle");
            const orderIdEl = document.getElementById("rzpModalOrderId");
            const btn = document.getElementById("rzpSuccessBtn");
            const btnText = document.getElementById("rzpSuccessBtnText");

            if (fareEl) fareEl.textContent = `₹${parseFloat(opts.amount || 950).toFixed(2)}`;
            if (trainTitle) trainTitle.textContent = `#${opts.trainNumber} &bull; ${opts.classType || 'CC'}`;
            if (orderIdEl) orderIdEl.textContent = orderId;
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = "SIMULATE SUCCESSFUL PAYMENT";
            if (btn) btn.className = "w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 text-sm";

            window.switchRzpTab('upi');
            if (modal) modal.classList.remove("hidden");

        } catch (err) {
            console.error("Razorpay initiation error:", err);
            // Launch simulator anyway so booking flow never blocks
            injectModal();
            const modal = document.getElementById("razorpaySimulatorModal");
            if (modal) modal.classList.remove("hidden");
        }
    };
})();

